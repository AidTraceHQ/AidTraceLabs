import { randomBytes, randomUUID } from 'node:crypto';
import { pool, withTransaction } from './db.js';
import { checkTransaction, type AidPayment, type Verification } from './stellar-verification.js';
import { enqueueStatusChange, lockRecordStatus } from './notifications.js';

export const REVERIFICATION_STALE_AFTER_HOURS = 24;
export const MAX_REVERIFICATION_BATCH_SIZE = 50;
export const MAX_REVERIFICATION_RUNTIME_MS = 2 * 60 * 1000;
const claimLeaseMs = 3 * 60 * 1000;

type ClaimedRecord = AidPayment & {
  id: string;
  latestVerificationId: string;
  updatedAt: string | null;
};

type RunOptions = {
  batchSize?: number;
  timeoutMs?: number;
  recordIds?: string[];
};

export type ReverificationSummary = {
  claimed: number;
  processed: number;
  pending: number;
  skipped: number;
  timedOut: boolean;
};

function toStroops(amount: string | undefined): string | null {
  if (!amount) return null;
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(amount);
  if (!match) return null;
  return (
    BigInt(match[1]) * 10_000_000n +
    BigInt((match[2] || '').padEnd(7, '0') || '0')
  ).toString();
}

async function claimRecords(
  limit: number,
  claimToken: string,
  recordIds?: string[],
): Promise<ClaimedRecord[]> {
  return withTransaction(async (client) => {
    const result = await client.query<{
      id: string;
      network: AidPayment['network'];
      tx_hash: string;
      organization_wallet: string;
      recipient_wallet: string;
      amount_stroops: string;
      asset_code: string;
      asset_issuer: string | null;
      latest_verification_id: string;
      updated_at: string | null;
    }>(
      `WITH eligible AS (
         SELECT r.id, r.network, r.tx_hash, r.organization_wallet, r.recipient_wallet,
                r.amount_stroops::text AS amount_stroops, r.asset_code, r.asset_issuer,
                r.updated_at::text AS updated_at, latest.id AS latest_verification_id
         FROM aid_records r
         JOIN LATERAL (
           SELECT v.id, v.checked_at
           FROM verification_results v
           WHERE v.aid_record_id = r.id
           ORDER BY v.checked_at DESC, v.id DESC
           LIMIT 1
         ) latest ON TRUE
         WHERE r.voided_at IS NULL
           AND r.status <> 'voided'
           AND r.tx_hash IS NOT NULL
           AND BTRIM(r.tx_hash) <> ''
           AND latest.checked_at <= NOW() - ($2::integer * INTERVAL '1 hour')
           AND ($5::text[] IS NULL OR r.id = ANY($5::text[]))
           AND NOT EXISTS (
             SELECT 1 FROM reverification_claims c
             WHERE c.record_id = r.id AND c.expires_at > NOW()
           )
         ORDER BY latest.checked_at ASC, r.id
         LIMIT $1
         FOR UPDATE OF r SKIP LOCKED
       ),
       claimed AS (
         INSERT INTO reverification_claims (record_id, claim_token, expires_at)
         SELECT id, $3, NOW() + ($4::integer * INTERVAL '1 millisecond')
         FROM eligible
         ON CONFLICT (record_id) DO UPDATE
           SET claim_token = EXCLUDED.claim_token,
               claimed_at = NOW(),
               expires_at = EXCLUDED.expires_at
           WHERE reverification_claims.expires_at <= NOW()
         RETURNING record_id
       )
       SELECT e.*, c.record_id
       FROM eligible e
       JOIN claimed c ON c.record_id = e.id`,
      [limit, REVERIFICATION_STALE_AFTER_HOURS, claimToken, claimLeaseMs, recordIds ?? null],
    );
    return result.rows.map((row) => ({
      id: row.id,
      network: row.network,
      txHash: row.tx_hash,
      organizationWallet: row.organization_wallet,
      recipientWallet: row.recipient_wallet,
      amountStroops: row.amount_stroops,
      assetCode: row.asset_code,
      assetIssuer: row.asset_issuer,
      latestVerificationId: row.latest_verification_id,
      updatedAt: row.updated_at,
    }));
  });
}

async function saveVerification(record: ClaimedRecord, result: Verification): Promise<boolean> {
  return withTransaction(async (client) => {
    const current = await client.query<{
      tx_hash: string | null;
      voided_at: Date | null;
      updated_at: string | null;
      latest_verification_id: string | null;
    }>(
      `SELECT r.tx_hash, r.voided_at, r.updated_at::text AS updated_at,
              (SELECT v.id FROM verification_results v
               WHERE v.aid_record_id = r.id
               ORDER BY v.checked_at DESC, v.id DESC LIMIT 1) AS latest_verification_id
       FROM aid_records r
       WHERE r.id = $1
       FOR UPDATE`,
      [record.id],
    );
    const row = current.rows[0];
    if (
      !row ||
      row.voided_at ||
      row.tx_hash !== record.txHash ||
      row.updated_at !== record.updatedAt ||
      row.latest_verification_id !== record.latestVerificationId
    ) {
      return false;
    }

    const previousStatus = await lockRecordStatus(client, record.id);
    await client.query(
      `INSERT INTO verification_results
         (id, aid_record_id, status, differences_json, reason, ledger,
          transaction_created_at, source_account, destination, amount_stroops,
          asset_code, asset_issuer, checked_at, cache_expires_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, NOW(),
               CASE WHEN $3 IN ('verified', 'mismatch') THEN NOW() + INTERVAL '1 hour' END)`,
      [
        randomBytes(16).toString('hex'),
        record.id,
        result.status,
        JSON.stringify(result.differences),
        result.reason || null,
        result.ledger ?? null,
        result.createdAt ? new Date(result.createdAt) : null,
        result.sourceAccount || null,
        result.destination || null,
        toStroops(result.amount),
        result.asset || null,
        result.assetIssuer || null,
      ],
    );
    await client.query(
      `UPDATE aid_records SET status = $2, updated_at = NOW()
       WHERE id = $1 AND voided_at IS NULL`,
      [record.id, result.status],
    );
    await enqueueStatusChange(client, record.id, previousStatus);
    return true;
  });
}

async function releaseClaims(recordIds: string[], claimToken: string): Promise<void> {
  if (!recordIds.length) return;
  await pool.query(
    'DELETE FROM reverification_claims WHERE record_id = ANY($1::text[]) AND claim_token = $2',
    [recordIds, claimToken],
  );
}

export async function runReverification(options: RunOptions = {}): Promise<ReverificationSummary> {
  const batchSize = Math.min(
    MAX_REVERIFICATION_BATCH_SIZE,
    Math.max(1, Math.floor(options.batchSize ?? MAX_REVERIFICATION_BATCH_SIZE)),
  );
  const timeoutMs = Math.min(
    MAX_REVERIFICATION_RUNTIME_MS,
    Math.max(1, Math.floor(options.timeoutMs ?? MAX_REVERIFICATION_RUNTIME_MS)),
  );
  const deadline = Date.now() + timeoutMs;
  const signal = AbortSignal.timeout(timeoutMs);
  const claimToken = randomUUID();
  const claimed = await claimRecords(batchSize, claimToken, options.recordIds);
  const summary: ReverificationSummary = {
    claimed: claimed.length,
    processed: 0,
    pending: 0,
    skipped: 0,
    timedOut: false,
  };

  try {
    for (const record of claimed) {
      if (Date.now() >= deadline) {
        summary.timedOut = true;
        break;
      }
      const verification = await checkTransaction(record, { signal });
      if (await saveVerification(record, verification)) {
        summary.processed += 1;
        if (verification.status === 'pending') summary.pending += 1;
      } else {
        summary.skipped += 1;
      }
      if (signal.aborted && summary.processed + summary.skipped < summary.claimed) {
        summary.timedOut = true;
        break;
      }
    }
    summary.timedOut ||= Date.now() >= deadline;
    return summary;
  } finally {
    await releaseClaims(
      claimed.map((record) => record.id),
      claimToken,
    );
  }
}
