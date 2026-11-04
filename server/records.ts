import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { StrKey } from '@stellar/stellar-sdk';
import type { PoolClient, QueryResultRow } from 'pg';
import { csrfMatches, getSession, rateLimit } from './auth.js';
import { pool, withTransaction } from './db.js';
import { noStore, requireAllowedOrigin } from './http-security.js';
import { resolvePseudonymSecret } from './pseudonym.js';
import { checkTransaction, type Verification } from './stellar-verification.js';
import { retryReadOnlyDatabase } from './database-errors.js';
import { publicReadIpRateLimit } from './rate-limits.js';

type Role = 'donor' | 'organization' | 'beneficiary' | 'admin';
type Network = 'testnet' | 'mainnet';
type RecordStatus = 'verified' | 'mismatch' | 'not-found' | 'unverified' | 'pending' | 'voided';
type Cursor = { createdAt: string; id: string };
type AidRecord = {
  id: string;
  recipient: string;
  recipientAddress: string;
  purpose: string;
  amount: string;
  asset: string;
  assetIssuer?: string;
  network: Network;
  txHash: string;
  date: string;
  note: string;
  organization: string;
  organizationName?: string;
  createdAt: string;
  status: RecordStatus;
  createdBy: string;
  recipientConsent?: boolean;
  verification?: Verification;
  voidReason?: string;
  voidedAt?: string;
  updatedAt?: string;
};

type RecordRow = QueryResultRow & {
  id: string;
  recipient_name: string;
  recipient_wallet: string;
  purpose: string;
  amount_stroops: string;
  asset_code: string;
  asset_issuer: string | null;
  network: Network;
  tx_hash: string | null;
  disbursement_date: Date | string;
  note: string;
  organization_wallet: string;
  organization_name: string;
  created_at: Date | string;
  updated_at: Date | string | null;
  status: RecordStatus;
  created_by: string;
  recipient_consent: boolean;
  void_reason: string | null;
  voided_at: Date | string | null;
  verification_status: Verification['status'] | null;
  verification_checked_at: Date | string | null;
  verification_differences: string[] | null;
  verification_reason: string | null;
  verification_ledger: string | number | null;
  verification_transaction_created_at: Date | string | null;
  verification_source_account: string | null;
  verification_destination: string | null;
  verification_amount_stroops: string | null;
  verification_asset_code: string | null;
  verification_asset_issuer: string | null;
  verification_link: string | null;
};

const recordStatuses = new Set<RecordStatus>([
  'verified',
  'mismatch',
  'not-found',
  'unverified',
  'pending',
  'voided',
]);
const roleValues = new Set<Role>(['donor', 'organization', 'beneficiary', 'admin']);
const amountPattern = /^(\d+)(?:\.(\d{1,7}))?$/;
const router = Router();
const pseudonymSecret = resolvePseudonymSecret();

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, maximum: number): string {
  return typeof value === 'string'
    ? value
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .trim()
        .slice(0, maximum)
    : '';
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function amountToStroops(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = amountPattern.exec(value);
  if (!match) return null;
  try {
    const stroops = BigInt(match[1]) * 10_000_000n + BigInt((match[2] || '').padEnd(7, '0') || '0');
    return stroops > 0n && stroops <= 9_223_372_036_854_775_807n ? stroops.toString() : null;
  } catch {
    return null;
  }
}

function stroopsToAmount(value: string): string {
  const stroops = BigInt(value);
  const whole = (stroops / 10_000_000n).toString();
  const fraction = (stroops % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '');
  return fraction ? whole + '.' + fraction : whole;
}

function validNetwork(value: unknown): value is Network {
  return value === 'testnet' || value === 'mainnet';
}

function validAddress(value: unknown): value is string {
  return typeof value === 'string' && StrKey.isValidEd25519PublicKey(value);
}

function validHash(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-fA-F]{64}$/.test(value);
}

function validateRecord(value: unknown) {
  if (!isObject(value)) return null;
  const recipient = cleanText(value.recipient, 160);
  const purpose = cleanText(value.purpose, 240);
  const note = cleanText(value.note, 500);
  const asset = cleanText(value.asset, 12).toUpperCase();
  const amountStroops = amountToStroops(value.amount);
  const assetIssuer =
    value.assetIssuer === '' || value.assetIssuer === undefined ? null : value.assetIssuer;

  if (
    !recipient ||
    !purpose ||
    !validAddress(value.recipientAddress) ||
    !amountStroops ||
    !/^[A-Z0-9]{1,12}$/.test(asset) ||
    !validNetwork(value.network) ||
    !validDate(value.date) ||
    typeof value.txHash !== 'string' ||
    (value.txHash !== '' && !validHash(value.txHash)) ||
    (asset === 'XLM' && assetIssuer !== null) ||
    (asset !== 'XLM' && !validAddress(assetIssuer)) ||
    (assetIssuer !== null && !validAddress(assetIssuer)) ||
    (value.recipientConsent !== undefined && typeof value.recipientConsent !== 'boolean')
  ) {
    return null;
  }

  return {
    recipient,
    recipientAddress: value.recipientAddress,
    purpose,
    amountStroops,
    asset,
    assetIssuer: typeof assetIssuer === 'string' ? assetIssuer : null,
    network: value.network,
    txHash: value.txHash.toLowerCase() || null,
    date: value.date,
    note,
    recipientConsent: value.recipientConsent === true,
  };
}

function timestamp(value: Date | string | null): string | undefined {
  if (value === null) return undefined;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
}

function dateOnly(value: Date | string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return (value instanceof Date ? value : new Date(value)).toISOString().slice(0, 10);
}

function mapRecord(row: RecordRow): AidRecord {
  const record: AidRecord = {
    id: row.id,
    recipient: row.recipient_name,
    recipientAddress: row.recipient_wallet,
    purpose: row.purpose,
    amount: stroopsToAmount(row.amount_stroops),
    asset: row.asset_code,
    assetIssuer: row.asset_issuer || '',
    network: row.network,
    txHash: row.tx_hash || '',
    date: dateOnly(row.disbursement_date),
    note: row.note,
    organization: row.organization_wallet,
    organizationName: row.organization_name,
    createdAt: timestamp(row.created_at)!,
    status: row.status,
    createdBy: row.created_by,
    recipientConsent: row.recipient_consent,
    updatedAt: timestamp(row.updated_at),
    voidReason: row.void_reason || undefined,
    voidedAt: timestamp(row.voided_at),
  };
  if (row.verification_status && row.verification_checked_at) {
    record.verification = {
      status: row.verification_status,
      checkedAt: timestamp(row.verification_checked_at)!,
      differences: row.verification_differences || [],
      ledger: row.verification_ledger === null ? undefined : Number(row.verification_ledger),
      createdAt: timestamp(row.verification_transaction_created_at),
      sourceAccount: row.verification_source_account || undefined,
      destination: row.verification_destination || undefined,
      amount: row.verification_amount_stroops
        ? stroopsToAmount(row.verification_amount_stroops)
        : undefined,
      asset: row.verification_asset_code || undefined,
      assetIssuer: row.verification_asset_issuer || undefined,
      link: row.verification_link || undefined,
      reason: row.verification_reason || undefined,
    };
  }
  return record;
}

const recordSelect = `
  SELECT r.id, r.recipient_name, r.recipient_wallet, r.purpose, r.amount_stroops::text,
         r.asset_code, r.asset_issuer, r.network, r.tx_hash, r.disbursement_date, r.note,
         r.organization_wallet, o.display_name AS organization_name, r.created_at, r.updated_at,
         r.status, r.created_by, r.recipient_consent, r.void_reason, r.voided_at,
         v.status AS verification_status, v.checked_at AS verification_checked_at,
         v.differences_json AS verification_differences, v.reason AS verification_reason,
         v.ledger AS verification_ledger, v.transaction_created_at AS verification_transaction_created_at,
         v.source_account AS verification_source_account, v.destination AS verification_destination,
         v.amount_stroops::text AS verification_amount_stroops, v.asset_code AS verification_asset_code,
         v.asset_issuer AS verification_asset_issuer,
         CASE WHEN v.ledger IS NULL THEN NULL ELSE
           CASE WHEN r.network = 'mainnet' THEN 'https://stellar.expert/explorer/public/tx/'
                ELSE 'https://stellar.expert/explorer/testnet/tx/' END || r.tx_hash
         END AS verification_link
  FROM aid_records r
  JOIN organizations o ON o.wallet_address = r.organization_wallet
  LEFT JOIN LATERAL (
    SELECT vr.status, vr.checked_at, vr.differences_json, vr.reason, vr.ledger,
           vr.transaction_created_at, vr.source_account, vr.destination, vr.amount_stroops,
           vr.asset_code, vr.asset_issuer
    FROM verification_results vr
    WHERE vr.aid_record_id = r.id
    ORDER BY vr.checked_at DESC, vr.id DESC
    LIMIT 1
  ) v ON TRUE`;

function publicRecord(record: AidRecord, consent: boolean): AidRecord {
  if (consent) return record;
  return {
    ...record,
    recipient:
      'Beneficiary-' +
      createHmac('sha256', pseudonymSecret)
        .update('aidtrace-beneficiary:')
        .update(record.recipientAddress)
        .digest('hex')
        .slice(0, 12),
    recipientAddress: '',
    txHash: '',
    note: '',
    verification: record.verification
      ? {
          ...record.verification,
          destination: undefined,
          link: undefined,
          createdAt: undefined,
          ledger: undefined,
        }
      : undefined,
  };
}

async function writeAudit(
  client: PoolClient,
  action: string,
  summary: string,
  actor: string,
  recordId?: string,
  subject?: string,
) {
  await client.query(
    `INSERT INTO audit_events (id, action, actor_wallet, subject_wallet, record_id, summary)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      randomBytes(16).toString('hex'),
      action,
      actor,
      subject || null,
      recordId || null,
      summary.slice(0, 1000),
    ],
  );
}

async function ensureOrganization(client: PoolClient, address: string) {
  const normalizedName = 'wallet-' + address.toLowerCase();
  await client.query(
    `INSERT INTO organizations (wallet_address, display_name, normalized_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (wallet_address) DO NOTHING`,
    [address, 'Organization ' + address.slice(-4), normalizedName],
  );
}

function error(response: Response, status: number, message: string) {
  response.status(status).json({ error: message });
}

async function authorize(
  request: Request,
  response: Response,
  allowedRoles?: Role[],
  write = false,
) {
  const current = await getSession(request);
  if (!current) {
    error(response, 401, 'Session expired. Reconnect Freighter to continue.');
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(current.session.role)) {
    error(response, 403, 'Your wallet role is not permitted to perform this action.');
    return null;
  }
  if (
    write &&
    (!requireAllowedOrigin(request, response) ||
      !csrfMatches(request.body?.csrfToken, current.session.csrfTokenHash))
  ) {
    if (!response.headersSent)
      error(response, 403, 'CSRF check failed. Refresh the app and retry.');
    return null;
  }
  if (write && !(await rateLimit('write:' + current.session.address, 60, 60 * 1000))) {
    error(response, 429, 'Write rate limit reached. Retry in a minute.');
    return null;
  }
  return current;
}

function readPage(
  request: Request,
  response: Response,
): { limit: number; cursor: Cursor | null } | null {
  const rawLimit = request.query.limit;
  const limit = rawLimit === undefined ? 20 : typeof rawLimit === 'string' ? Number(rawLimit) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    error(response, 400, 'limit must be an integer between 1 and 100.');
    return null;
  }
  const rawCursor = request.query.cursor;
  if (rawCursor === undefined) return { limit, cursor: null };
  if (typeof rawCursor !== 'string' || rawCursor.length > 512) {
    error(response, 400, 'Invalid pagination cursor.');
    return null;
  }
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(rawCursor)) throw new Error('Invalid cursor envelope.');
    const envelope: unknown = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
    if (
      !isObject(envelope) ||
      typeof envelope.payload !== 'string' ||
      typeof envelope.signature !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(envelope.signature)
    ) {
      throw new Error('Invalid cursor envelope.');
    }
    const expectedSignature = createHmac('sha256', process.env.SESSION_SECRET || '')
      .update(envelope.payload)
      .digest();
    const suppliedSignature = Buffer.from(envelope.signature, 'base64url');
    if (
      suppliedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(suppliedSignature, expectedSignature)
    ) {
      throw new Error('Invalid cursor signature.');
    }
    const parsed: unknown = JSON.parse(Buffer.from(envelope.payload, 'base64url').toString('utf8'));
    const filters = Object.entries(request.query)
      .filter(([key]) => key !== 'cursor' && key !== 'limit')
      .sort(([left], [right]) => left.localeCompare(right));
    const filterDigest = createHmac('sha256', process.env.SESSION_SECRET || '')
      .update(JSON.stringify(filters))
      .digest('base64url');
    if (
      !isObject(parsed) ||
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.id !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(parsed.id) ||
      parsed.version !== 1 ||
      parsed.filters !== filterDigest ||
      Number.isNaN(Date.parse(parsed.createdAt))
    ) {
      throw new Error('Invalid cursor.');
    }
    return {
      limit,
      cursor: { createdAt: new Date(parsed.createdAt).toISOString(), id: parsed.id },
    };
  } catch {
    error(response, 400, 'Invalid pagination cursor.');
    return null;
  }
}

function addFilter(conditions: string[], values: unknown[], expression: string, value: unknown) {
  values.push(value);
  conditions.push(expression.replace('?', '$' + values.length));
}

function addCursor(
  conditions: string[],
  values: unknown[],
  cursor: Cursor | null,
  timeColumn: string,
  idColumn: string,
) {
  if (!cursor) return;
  values.push(cursor.createdAt, cursor.id);
  conditions.push(`(${timeColumn}, ${idColumn}) < ($${values.length - 1}, $${values.length})`);
}

async function listRows<Row extends QueryResultRow>(
  select: string,
  conditions: string[],
  values: unknown[],
  timeColumn: string,
  idColumn: string,
  page: { limit: number; cursor: Cursor | null },
) {
  addCursor(conditions, values, page.cursor, timeColumn, idColumn);
  values.push(page.limit + 1);
  const result = await pool.query<Row>(
    `${select}
     WHERE ${conditions.length ? conditions.join(' AND ') : 'TRUE'}
     ORDER BY ${timeColumn} DESC, ${idColumn} DESC
     LIMIT $${values.length}`,
    values,
  );
  const hasMore = result.rows.length > page.limit;
  return { rows: result.rows.slice(0, page.limit), hasMore };
}

function sendPage<T>(
  request: Request,
  response: Response,
  key: 'records' | 'roles' | 'entries',
  items: T[],
  hasMore: boolean,
  limit: number,
  cursorFor: (item: T) => Cursor,
  extra: Record<string, unknown> = {},
) {
  const cursorData = hasMore && items.length ? cursorFor(items[items.length - 1]!) : null;
  const filterValues = Object.entries(request.query)
    .filter(([name]) => name !== 'cursor' && name !== 'limit')
    .sort(([left], [right]) => left.localeCompare(right));
  const cursorPayload = cursorData
    ? Buffer.from(
        JSON.stringify({
          version: 1,
          ...cursorData,
          filters: createHmac('sha256', process.env.SESSION_SECRET || '')
            .update(JSON.stringify(filterValues))
            .digest('base64url'),
        }),
      ).toString('base64url')
    : null;
  const nextCursor = cursorPayload
    ? Buffer.from(
        JSON.stringify({
          payload: cursorPayload,
          signature: createHmac('sha256', process.env.SESSION_SECRET || '')
            .update(cursorPayload)
            .digest('base64url'),
        }),
      ).toString('base64url')
    : null;
  response.set('X-Has-More', String(hasMore));
  if (nextCursor) {
    response.set('X-Next-Cursor', nextCursor);
    const next = new URL(request.originalUrl, 'http://localhost');
    next.searchParams.set('limit', String(limit));
    next.searchParams.set('cursor', nextCursor);
    response.set('Link', '<' + next.pathname + next.search + '>; rel="next"');
  }
  response.json({ ...extra, [key]: items, nextCursor, hasMore });
}

function optionalQuery(request: Request, name: string): string | undefined | null {
  const value = request.query[name];
  if (value === undefined) return undefined;
  return typeof value === 'string' && value.length <= 160 ? value : null;
}

function applyRecordFilters(
  request: Request,
  response: Response,
  conditions: string[],
  values: unknown[],
): boolean {
  const network = optionalQuery(request, 'network');
  const status = optionalQuery(request, 'status');
  const organization = optionalQuery(request, 'organization');
  const asset = optionalQuery(request, 'asset');
  const from = optionalQuery(request, 'from');
  const to = optionalQuery(request, 'to');
  const search = optionalQuery(request, 'q');
  if ([network, status, organization, asset, from, to, search].some((value) => value === null)) {
    error(response, 400, 'Invalid list filter.');
    return false;
  }
  if (typeof network === 'string') {
    if (!validNetwork(network)) {
      error(response, 400, 'Invalid network filter.');
      return false;
    }
    addFilter(conditions, values, 'r.network = ?', network);
  }
  if (typeof status === 'string') {
    if (!recordStatuses.has(status as RecordStatus)) {
      error(response, 400, 'Invalid status filter.');
      return false;
    }
    addFilter(conditions, values, 'r.status = ?', status);
  }
  if (typeof organization === 'string') {
    if (!validAddress(organization)) {
      error(response, 400, 'Invalid organization filter.');
      return false;
    }
    addFilter(conditions, values, 'r.organization_wallet = ?', organization);
  }
  if (typeof asset === 'string') {
    if (!/^[A-Za-z0-9]{1,12}$/.test(asset)) {
      error(response, 400, 'Invalid asset filter.');
      return false;
    }
    addFilter(conditions, values, 'r.asset_code = ?', asset.toUpperCase());
  }
  if (typeof from === 'string') {
    if (!validDate(from)) {
      error(response, 400, 'Invalid from date.');
      return false;
    }
    addFilter(conditions, values, 'r.disbursement_date >= ?', from);
  }
  if (typeof to === 'string') {
    if (!validDate(to)) {
      error(response, 400, 'Invalid to date.');
      return false;
    }
    addFilter(conditions, values, 'r.disbursement_date <= ?', to);
  }
  if (typeof search === 'string') {
    if (!search.trim()) {
      error(response, 400, 'Search query cannot be empty.');
      return false;
    }
    const firstPlaceholder = values.length + 1;
    values.push(search.trim(), search.trim(), search.trim());
    conditions.push(
      `(strpos(lower(r.purpose), lower($${firstPlaceholder})) > 0 OR ` +
        `strpos(lower(o.display_name), lower($${firstPlaceholder + 1})) > 0 OR ` +
        `strpos(lower(r.id), lower($${firstPlaceholder + 2})) > 0)`,
    );
  }
  return true;
}

function optionalDateFilter(
  request: Request,
  response: Response,
  name: string,
  expression: string,
  conditions: string[],
  values: unknown[],
): boolean {
  const value = optionalQuery(request, name);
  if (value === undefined) return true;
  if (value === null || !validDate(value)) {
    error(response, 400, 'Invalid ' + name + ' date.');
    return false;
  }
  addFilter(conditions, values, expression, value);
  return true;
}

async function getRecord(id: string): Promise<{ record: AidRecord; consent: boolean } | null> {
  const result = await pool.query<RecordRow>(`${recordSelect} WHERE r.id = $1`, [id]);
  const row = result.rows[0];
  return row ? { record: mapRecord(row), consent: row.recipient_consent } : null;
}

function uniqueViolation(errorValue: unknown): boolean {
  return isObject(errorValue) && errorValue.code === '23505';
}

async function recordVerification(
  record: AidRecord,
  recipientWallet: string,
  amountStroops: string,
  assetCode: string,
  assetIssuer: string | null,
): Promise<Verification> {
  if (!record.txHash) {
    return {
      status: 'unverified',
      checkedAt: new Date().toISOString(),
      differences: [],
      reason: 'No transaction hash was supplied.',
    };
  }
  return checkTransaction({
    network: record.network,
    txHash: record.txHash,
    organizationWallet: record.organization,
    recipientWallet,
    amountStroops,
    assetCode,
    assetIssuer,
  });
}

async function storeVerification(
  client: PoolClient,
  recordId: string,
  status: Verification['status'],
  result: Verification,
  amountStroops: string | null,
  assetCode: string | null,
) {
  await client.query(
    `INSERT INTO verification_results
       (id, aid_record_id, status, differences_json, reason, ledger,
        transaction_created_at, source_account, destination, amount_stroops,
        asset_code, asset_issuer, checked_at, cache_expires_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, NOW(),
             CASE WHEN $3 IN ('verified', 'mismatch') THEN NOW() + INTERVAL '1 hour' END)`,
    [
      randomBytes(16).toString('hex'),
      recordId,
      status,
      JSON.stringify(result.differences),
      result.reason || null,
      result.ledger ?? null,
      result.createdAt ? new Date(result.createdAt) : null,
      result.sourceAccount || null,
      result.destination || null,
      amountStroops,
      assetCode,
      result.assetIssuer || null,
    ],
  );
  await client.query(
    `UPDATE aid_records
     SET status = CASE WHEN voided_at IS NULL THEN $2 ELSE 'voided' END, updated_at = NOW()
     WHERE id = $1`,
    [recordId, status],
  );
}

async function cachedVerification(id: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM verification_results
     WHERE id = (
       SELECT id FROM verification_results
       WHERE aid_record_id = $1
       ORDER BY checked_at DESC, id DESC LIMIT 1
     ) AND status IN ('verified', 'mismatch') AND cache_expires_at > NOW()`,
    [id],
  );
  return result.rowCount === 1;
}

async function transparencyHandler(request: Request, response: Response): Promise<void> {
  const current = await getSession(request);
  const page = readPage(request, response);
  if (!page) return;
  const conditions = ['TRUE'];
  const values: unknown[] = [];
  if (!applyRecordFilters(request, response, conditions, values)) return;
  const summaryResult = await pool.query<{
    status: RecordStatus;
    asset_code: string;
    amount_stroops: string;
  }>(
    `SELECT r.status, r.asset_code, SUM(r.amount_stroops)::text AS amount_stroops
     FROM aid_records r
     JOIN organizations o ON o.wallet_address = r.organization_wallet
     WHERE ${conditions.join(' AND ')}
     GROUP BY r.status, r.asset_code
     ORDER BY r.status, r.asset_code`,
    values,
  );
  const result = await listRows<RecordRow>(
    recordSelect,
    conditions,
    values,
    'r.created_at',
    'r.id',
    page,
  );
  const facets = await pool.query<{ organizations: string[]; assets: string[] }>(
    `SELECT ARRAY(
       SELECT DISTINCT organization_wallet FROM aid_records ORDER BY organization_wallet
     ) AS organizations,
     ARRAY(
       SELECT DISTINCT asset_code FROM aid_records ORDER BY asset_code
     ) AS assets`,
  );
  const records = result.rows.map((row) => {
    const record = mapRecord(row);
    const mayViewPrivateData =
      current &&
      (current.session.role === 'admin' ||
        (current.session.role === 'organization' &&
          current.session.address === record.organization));
    return mayViewPrivateData ? record : publicRecord(record, row.recipient_consent);
  });
  const summary = {
    byStatus: summaryResult.rows.map((row) => ({
      status: row.status,
      asset: row.asset_code,
      amount: stroopsToAmount(row.amount_stroops),
    })),
  };
  sendPage(
    request,
    response,
    'records',
    records,
    result.hasMore,
    page.limit,
    (item) => ({
      createdAt: item.createdAt,
      id: item.id,
    }),
    {
      facets: facets.rows[0] || { organizations: [], assets: [] },
      summary,
    },
  );
}

router.get('/api/transparency', noStore, publicReadIpRateLimit, (request, response) =>
  retryReadOnlyDatabase('/api/transparency', () => transparencyHandler(request, response)),
);

router.get('/api/beneficiary', noStore, async (request, response) => {
  const current = await authorize(request, response, ['beneficiary', 'admin']);
  if (!current) return;
  const page = readPage(request, response);
  if (!page) return;
  const conditions = ['r.recipient_wallet = $1'];
  const values: unknown[] = [current.session.address];
  if (!applyRecordFilters(request, response, conditions, values)) return;
  const result = await listRows<RecordRow>(
    recordSelect,
    conditions,
    values,
    'r.created_at',
    'r.id',
    page,
  );
  const records = result.rows.map((row) => mapRecord(row));
  sendPage(request, response, 'records', records, result.hasMore, page.limit, (item) => ({
    createdAt: item.createdAt,
    id: item.id,
  }));
});

router.post('/api/records', noStore, async (request, response) => {
  const current = await authorize(request, response, ['organization', 'admin'], true);
  if (!current) return;
  const recordInput = validateRecord(request.body);
  if (!recordInput) {
    error(
      response,
      400,
      'Invalid record. Check address, positive amount, asset, network, date and transaction hash.',
    );
    return;
  }
  const id = randomBytes(16).toString('hex');
  const initialStatus: RecordStatus = recordInput.txHash ? 'pending' : 'unverified';
  try {
    await withTransaction(async (client) => {
      await ensureOrganization(client, current.session.address);
      await client.query(
        `INSERT INTO aid_records
           (id, organization_wallet, recipient_name, recipient_wallet, purpose, amount_stroops,
            asset_code, asset_issuer, network, tx_hash, disbursement_date, note, recipient_consent,
            status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          id,
          current.session.address,
          recordInput.recipient,
          recordInput.recipientAddress,
          recordInput.purpose,
          recordInput.amountStroops,
          recordInput.asset,
          recordInput.assetIssuer,
          recordInput.network,
          recordInput.txHash,
          recordInput.date,
          recordInput.note,
          recordInput.recipientConsent,
          initialStatus,
          current.session.address,
        ],
      );
      await writeAudit(
        client,
        'record_created',
        'Created aid record ' + id + '.',
        current.session.address,
        id,
      );
    });
  } catch (writeError) {
    if (uniqueViolation(writeError)) {
      error(response, 409, 'A record already exists for this network and transaction hash.');
      return;
    }
    throw writeError;
  }

  let saved = await getRecord(id);
  if (!saved) throw new Error('Created aid record could not be reloaded.');
  const verification = await recordVerification(
    saved.record,
    recordInput.recipientAddress,
    recordInput.amountStroops,
    recordInput.asset,
    recordInput.assetIssuer,
  );
  await withTransaction(async (client) => {
    await storeVerification(
      client,
      id,
      verification.status,
      verification,
      verification.amount ? amountToStroops(verification.amount) : null,
      verification.asset || null,
    );
  });
  saved = await getRecord(id);
  if (!saved) throw new Error('Verified aid record could not be reloaded.');
  response.status(201).json({ record: saved.record });
});

router.post('/api/records/:id/verify', noStore, async (request, response) => {
  const current = await authorize(request, response, undefined, true);
  if (!current) return;
  if (!(await rateLimit('record-verify:' + current.session.address, 30, 60 * 1000))) {
    error(response, 429, 'Verification rate limit reached. Retry in a minute.');
    return;
  }
  const recordId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const existing = await getRecord(recordId || '');
  if (!existing) {
    error(response, 404, 'Record not found.');
    return;
  }
  if (await cachedVerification(existing.record.id)) {
    response.json({ record: existing.record });
    return;
  }
  const result = await recordVerification(
    existing.record,
    existing.record.recipientAddress,
    amountToStroops(existing.record.amount)!,
    existing.record.asset,
    existing.record.assetIssuer || null,
  );
  await withTransaction(async (client) => {
    await storeVerification(
      client,
      existing.record.id,
      result.status,
      result,
      result.amount ? amountToStroops(result.amount) : null,
      result.asset || null,
    );
    await writeAudit(
      client,
      'record_verification_checked',
      'Verification status ' + result.status + ' for aid record ' + existing.record.id + '.',
      current.session.address,
      existing.record.id,
    );
  });
  const updated = await getRecord(existing.record.id);
  if (!updated) throw new Error('Verified aid record could not be reloaded.');
  response.json({ record: updated.record });
});

router.put('/api/records/:id', noStore, async (request, response) => {
  const current = await authorize(request, response, ['organization', 'admin'], true);
  if (!current) return;
  const recordId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const existing = await getRecord(recordId || '');
  if (!existing) {
    error(response, 404, 'Record not found.');
    return;
  }
  if (
    current.session.role !== 'admin' &&
    existing.record.organization !== current.session.address
  ) {
    error(response, 403, 'Organizations can edit only their own records.');
    return;
  }
  if (existing.record.voidedAt) {
    error(response, 409, 'Voided records cannot be edited.');
    return;
  }
  const recordInput = validateRecord(request.body);
  if (!recordInput) {
    error(response, 400, 'Invalid record fields.');
    return;
  }
  const initialStatus: RecordStatus = recordInput.txHash ? 'pending' : 'unverified';
  try {
    const result = await withTransaction(async (client) => {
      const update = await client.query(
        `UPDATE aid_records
         SET recipient_name = $2, recipient_wallet = $3, purpose = $4, amount_stroops = $5,
             asset_code = $6, asset_issuer = $7, network = $8, tx_hash = $9,
             disbursement_date = $10, note = $11, recipient_consent = $12,
             status = $13, updated_at = NOW()
         WHERE id = $1 AND organization_wallet = $14 AND voided_at IS NULL
           AND updated_at IS NOT DISTINCT FROM $15`,
        [
          existing.record.id,
          recordInput.recipient,
          recordInput.recipientAddress,
          recordInput.purpose,
          recordInput.amountStroops,
          recordInput.asset,
          recordInput.assetIssuer,
          recordInput.network,
          recordInput.txHash,
          recordInput.date,
          recordInput.note,
          recordInput.recipientConsent,
          initialStatus,
          existing.record.organization,
          existing.record.updatedAt ? new Date(existing.record.updatedAt) : null,
        ],
      );
      if (update.rowCount === 1) {
        await client.query(
          `INSERT INTO verification_results (id, aid_record_id, status, differences_json, reason, checked_at)
           VALUES ($1, $2, $3, '[]'::jsonb, $4, NOW())`,
          [
            randomBytes(16).toString('hex'),
            existing.record.id,
            recordInput.txHash ? 'pending' : 'unverified',
            recordInput.txHash
              ? 'Record changed; verification is pending.'
              : 'No transaction hash was supplied.',
          ],
        );
        await writeAudit(
          client,
          'record_updated',
          'Updated aid record ' + existing.record.id + '.',
          current.session.address,
          existing.record.id,
        );
      }
      return update;
    });
    if (result.rowCount !== 1) {
      error(response, 409, 'Record changed concurrently. Refresh before editing.');
      return;
    }
  } catch (writeError) {
    if (uniqueViolation(writeError)) {
      error(response, 409, 'A record already exists for this network and transaction hash.');
      return;
    }
    throw writeError;
  }

  const updated = await getRecord(existing.record.id);
  if (!updated) throw new Error('Updated aid record could not be reloaded.');
  const verification = await recordVerification(
    updated.record,
    recordInput.recipientAddress,
    recordInput.amountStroops,
    recordInput.asset,
    recordInput.assetIssuer,
  );
  await withTransaction(async (client) => {
    await storeVerification(
      client,
      updated.record.id,
      verification.status,
      verification,
      verification.amount ? amountToStroops(verification.amount) : null,
      verification.asset || null,
    );
  });
  const finalRecord = await getRecord(updated.record.id);
  if (!finalRecord) throw new Error('Updated aid record could not be reloaded.');
  response.json({ record: finalRecord.record });
});

router.post('/api/records/:id/void', noStore, async (request, response) => {
  const current = await authorize(request, response, ['organization', 'admin'], true);
  if (!current) return;
  const recordId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const existing = await getRecord(recordId || '');
  if (!existing) {
    error(response, 404, 'Record not found.');
    return;
  }
  if (
    current.session.role !== 'admin' &&
    existing.record.organization !== current.session.address
  ) {
    error(response, 403, 'Organizations can void only their own records.');
    return;
  }
  if (existing.record.voidedAt) {
    error(response, 409, 'Record is already voided.');
    return;
  }
  const reason = cleanText(isObject(request.body) ? request.body.reason : undefined, 500);
  if (reason.length < 5) {
    error(response, 400, 'Provide a meaningful void reason (at least five characters).');
    return;
  }
  const voidedAt = new Date();
  const result = await withTransaction(async (client) => {
    const update = await client.query(
      `UPDATE aid_records
       SET status = 'voided', void_reason = $2, voided_by = $3, voided_at = $4, updated_at = NOW()
       WHERE id = $1 AND organization_wallet = $5 AND voided_at IS NULL`,
      [existing.record.id, reason, current.session.address, voidedAt, existing.record.organization],
    );
    if (update.rowCount === 1) {
      await writeAudit(
        client,
        'record_voided',
        'Voided aid record ' + existing.record.id + '.',
        current.session.address,
        existing.record.id,
      );
    }
    return update;
  });
  if (result.rowCount !== 1) {
    error(response, 409, 'Record changed or was already voided.');
    return;
  }
  const updated = await getRecord(existing.record.id);
  if (!updated) throw new Error('Voided aid record could not be reloaded.');
  response.json({ record: updated.record });
});

router.get('/api/admin/roles', noStore, async (request, response) => {
  const current = await authorize(request, response, ['admin']);
  if (!current) return;
  const page = readPage(request, response);
  if (!page) return;
  const conditions: string[] = [];
  const values: unknown[] = [];
  const role = optionalQuery(request, 'role');
  const search = optionalQuery(request, 'q');
  if (role === null || search === null || (role !== undefined && !roleValues.has(role as Role))) {
    error(response, 400, 'Invalid role list filter.');
    return;
  }
  if (role !== undefined) addFilter(conditions, values, 'wr.role = ?', role);
  if (search !== undefined) {
    values.push('%' + search.toLowerCase() + '%');
    conditions.push('lower(wr.wallet_address) LIKE $' + values.length);
  }
  const result = await listRows<
    QueryResultRow & {
      id: string;
      wallet_address: string;
      role: Role;
      updated_at: Date | string;
      updated_by: string;
    }
  >(
    `SELECT wr.wallet_address AS id, wr.wallet_address, wr.role, wr.updated_at, wr.updated_by
     FROM wallet_roles wr`,
    conditions,
    values,
    'wr.updated_at',
    'wr.wallet_address',
    page,
  );
  const roles = result.rows.map((row) => ({
    id: row.id,
    address: row.wallet_address,
    role: row.role,
    updatedAt: timestamp(row.updated_at)!,
    updatedBy: row.updated_by,
  }));
  sendPage(request, response, 'roles', roles, result.hasMore, page.limit, (item) => ({
    createdAt: item.updatedAt,
    id: item.address,
  }));
});

router.post('/api/admin/roles', noStore, async (request, response) => {
  const current = await authorize(request, response, ['admin'], true);
  if (!current) return;
  const body = isObject(request.body) ? request.body : {};
  const address = body.address;
  const role = body.role;
  if (!validAddress(address) || typeof role !== 'string' || !roleValues.has(role as Role)) {
    error(response, 400, 'Valid wallet address and role required.');
    return;
  }
  if (address === current.session.address && role !== 'admin') {
    error(response, 409, 'You cannot demote your own active admin wallet.');
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO users (wallet_address) VALUES ($1) ON CONFLICT (wallet_address) DO NOTHING',
      [address],
    );
    const old = await client.query<{ role: Role }>(
      'SELECT role FROM wallet_roles WHERE wallet_address = $1 FOR UPDATE',
      [address],
    );
    await client.query(
      `INSERT INTO wallet_roles (wallet_address, role, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (wallet_address)
       DO UPDATE SET role = EXCLUDED.role, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [address, role, current.session.address],
    );
    if (role === 'organization') await ensureOrganization(client, address);
    await writeAudit(
      client,
      'wallet_role_changed',
      'Changed wallet role from ' + (old.rows[0]?.role || 'implicit donor') + ' to ' + role + '.',
      current.session.address,
      undefined,
      address,
    );
    await client.query('COMMIT');
  } catch (errorValue) {
    await client.query('ROLLBACK');
    throw errorValue;
  } finally {
    client.release();
  }
  response.json({ ok: true });
});

router.delete('/api/admin/roles/:address', noStore, async (request, response) => {
  const current = await authorize(request, response, ['admin'], true);
  if (!current) return;
  const address = Array.isArray(request.params.address)
    ? request.params.address[0]
    : request.params.address;
  if (!validAddress(address)) {
    error(response, 400, 'Invalid wallet address.');
    return;
  }
  if (address === current.session.address) {
    error(response, 409, 'Cannot remove your own active admin role.');
    return;
  }
  const client = await pool.connect();
  let oldRole: Role | undefined;
  try {
    await client.query('BEGIN');
    const old = await client.query<{ role: Role }>(
      'SELECT role FROM wallet_roles WHERE wallet_address = $1 FOR UPDATE',
      [address],
    );
    oldRole = old.rows[0]?.role;
    if (!oldRole) {
      await client.query('ROLLBACK');
      error(response, 404, 'Explicit role not found.');
      return;
    }
    await client.query('DELETE FROM wallet_roles WHERE wallet_address = $1', [address]);
    await writeAudit(
      client,
      'wallet_role_removed',
      'Removed wallet role ' + oldRole + '; wallet now defaults to donor.',
      current.session.address,
      undefined,
      address,
    );
    await client.query('COMMIT');
  } catch (errorValue) {
    await client.query('ROLLBACK');
    throw errorValue;
  } finally {
    client.release();
  }
  response.json({ ok: true });
});

router.get('/api/audit', noStore, async (request, response) => {
  const current = await authorize(request, response, ['admin']);
  if (!current) return;
  const page = readPage(request, response);
  if (!page) return;
  const conditions: string[] = [];
  const values: unknown[] = [];
  const action = optionalQuery(request, 'action');
  const address = optionalQuery(request, 'address');
  const recordId = optionalQuery(request, 'recordId');
  const search = optionalQuery(request, 'q');
  if (action === null || address === null || recordId === null || search === null) {
    error(response, 400, 'Invalid audit list filter.');
    return;
  }
  if (action !== undefined) addFilter(conditions, values, 'ae.action = ?', action);
  if (address !== undefined) {
    if (!validAddress(address)) {
      error(response, 400, 'Invalid audit address filter.');
      return;
    }
    addFilter(conditions, values, 'ae.actor_wallet = ?', address);
  }
  if (recordId !== undefined) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(recordId)) {
      error(response, 400, 'Invalid audit record filter.');
      return;
    }
    addFilter(conditions, values, 'ae.record_id = ?', recordId);
  }
  if (typeof search === 'string') {
    if (!search.trim()) {
      error(response, 400, 'Search query cannot be empty.');
      return;
    }
    const firstPlaceholder = values.length + 1;
    values.push(search.trim(), search.trim(), search.trim());
    conditions.push(
      `(strpos(lower(ae.summary), lower($${firstPlaceholder})) > 0 OR ` +
        `strpos(lower(COALESCE(ae.actor_wallet, '')), lower($${firstPlaceholder + 1})) > 0 OR ` +
        `strpos(lower(COALESCE(ae.record_id, '')), lower($${firstPlaceholder + 2})) > 0)`,
    );
  }
  if (
    !optionalDateFilter(request, response, 'from', 'ae.created_at >= ?', conditions, values) ||
    !optionalDateFilter(
      request,
      response,
      'to',
      "ae.created_at < (?::date + INTERVAL '1 day')",
      conditions,
      values,
    )
  ) {
    return;
  }
  const result = await listRows<
    QueryResultRow & {
      id: string;
      action: string;
      summary: string;
      actor_wallet: string | null;
      record_id: string | null;
      created_at: Date | string;
    }
  >(
    `SELECT ae.id, ae.action, ae.summary, ae.actor_wallet, ae.record_id, ae.created_at
     FROM audit_events ae`,
    conditions,
    values,
    'ae.created_at',
    'ae.id',
    page,
  );
  const entries = result.rows.map((row) => ({
    id: row.id,
    action: row.action,
    summary: row.summary,
    address: row.actor_wallet || '',
    recordId: row.record_id || undefined,
    createdAt: timestamp(row.created_at)!,
  }));
  const facets = await pool.query<{ actions: string[] }>(
    'SELECT ARRAY(SELECT DISTINCT action FROM audit_events ORDER BY action) AS actions',
  );
  sendPage(
    request,
    response,
    'entries',
    entries,
    result.hasMore,
    page.limit,
    (item) => ({
      createdAt: item.createdAt,
      id: item.id,
    }),
    { facets: { actions: facets.rows[0]?.actions || [] } },
  );
});

export { router as recordsRouter, validateRecord, amountToStroops, stroopsToAmount };
