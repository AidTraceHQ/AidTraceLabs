import { createHash, createHmac, randomUUID } from 'node:crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { applyUniqueNetworkTxHashMigration, migrate } from '../scripts/migrate.js';
import { app } from '../server/app.js';
import { getSession, verifySep53Signature } from '../server/auth.js';
import { IDLE_IN_TRANSACTION_TIMEOUT_MS, pool } from '../server/db.js';
import { checkTransaction, HORIZON_MAX_RESPONSE_BYTES } from '../server/stellar-verification.js';

const origin = 'http://localhost:5173';

describe('Freighter signed challenge creates a secure session', () => {
  it('verifies SEP-53 signatures with the Stellar SDK and rejects altered messages', () => {
    const wallet = Keypair.random();
    const message = [
      'AidTrace wallet login',
      'Domain: http://localhost:5173',
      'Address: ' + wallet.publicKey(),
      'Network: testnet',
      'Nonce: ' + 'a'.repeat(64),
      'Issued At: 2026-10-28T09:55:00.000Z',
      'Expires: 2026-10-28T10:00:00.000Z',
      'Purpose: prove wallet ownership; no transaction will be sent.',
    ].join('\n');
    const digest = createHash('sha256')
      .update('Stellar Signed Message:\n')
      .update(message)
      .digest();
    const signature = Buffer.from(wallet.sign(digest)).toString('base64');

    expect(verifySep53Signature(wallet.publicKey(), message, signature)).toBe(true);
    expect(verifySep53Signature(wallet.publicKey(), message + '\nchanged', signature)).toBe(false);
    expect(verifySep53Signature(wallet.publicKey(), message, 'not-a-signature')).toBe(false);
  });

  it('enforces trusted origins and denies protected routes without a session', async () => {
    const health = await request(app).get('/api/_healthcheck');
    expect(health.status).toBe(200);
    expect(health.headers['cache-control']).toBe('no-store');

    const noOrigin = await request(app)
      .post('/api/auth/challenge')
      .send({ address: 'invalid', network: 'testnet' });
    expect(noOrigin.status).toBe(403);

    const untrustedOrigin = await request(app)
      .post('/api/auth/challenge')
      .set('Origin', 'https://attacker.example')
      .send({ address: 'invalid', network: 'testnet' });
    expect(untrustedOrigin.status).toBe(403);

    const session = await request(app).get('/api/me');
    expect(session.status).toBe(200);
    expect(session.body.session).toBeNull();

    const protectedRequest = await request(app).post('/api/records').set('Origin', origin).send({});
    expect(protectedRequest.status).toBe(401);
  });

  it('rejects malformed JSON and returns a credentialed CORS preflight', async () => {
    const malformed = await request(app)
      .post('/api/records')
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send('{');
    expect(malformed.status).toBe(400);

    const unsupportedCharset = await request(app)
      .post('/api/records')
      .set('Origin', origin)
      .set('Content-Type', 'application/json; charset=utf-16le')
      .send('{}');
    expect(unsupportedCharset.status).toBe(415);
    expect(unsupportedCharset.body).toEqual({ error: 'Unsupported request encoding.' });

    const unsupportedEncoding = await request(app)
      .post('/api/records')
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'compress')
      .send('{}');
    expect(unsupportedEncoding.status).toBe(415);
    expect(unsupportedEncoding.body).toEqual({ error: 'Unsupported request encoding.' });

    const preflight = await request(app)
      .options('/api/records')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(origin);
    expect(preflight.headers['access-control-allow-credentials']).toBe('true');
  });

  it('returns 413 with a stable error body when a JSON body exceeds the 32 KB limit', async () => {
    const oversized = JSON.stringify({ purpose: 'x'.repeat(32 * 1024 + 1) });
    const response = await request(app)
      .post('/api/records')
      .set('Origin', origin)
      .set('Content-Type', 'application/json')
      .send(oversized);
    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: 'Request body is too large.' });
  });
});

describe('On-chain verification distinguishes matching and mismatching payments', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requires one operation to match the organization source and all payment fields', async () => {
    const organization = Keypair.random().publicKey();
    const recipient = Keypair.random().publicKey();
    const other = Keypair.random().publicKey();
    const txHash = 'a'.repeat(64);
    const transaction = {
      successful: true,
      source_account: organization,
      ledger: 42,
      created_at: '2026-01-01T00:00:00Z',
    };
    let operations: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input) => {
        const url = new URL(String(input));
        const body = url.pathname.endsWith('/operations')
          ? { _embedded: { records: operations } }
          : transaction;
        return new Response(JSON.stringify(body), { status: 200 });
      }),
    );

    const record = {
      network: 'testnet' as const,
      txHash,
      organizationWallet: organization,
      recipientWallet: recipient,
      amountStroops: '12345000',
      assetCode: 'XLM',
      assetIssuer: null,
    };
    operations = [
      {
        type: 'payment',
        from: organization,
        to: recipient,
        amount: '1.2345',
        asset_type: 'native',
      },
    ];
    expect((await checkTransaction(record)).status).toBe('verified');

    operations = [
      {
        type: 'payment',
        from: other,
        to: recipient,
        amount: '1.2345',
        asset_type: 'native',
      },
    ];
    const wrongSource = await checkTransaction(record);
    expect(wrongSource.status).toBe('mismatch');
    expect(wrongSource.differences.join(' ')).toContain('source');

    operations = [
      {
        type: 'payment',
        from: other,
        to: recipient,
        amount: '1.2345',
        asset_type: 'native',
      },
      {
        type: 'payment',
        from: organization,
        to: other,
        amount: '1.2345',
        asset_type: 'native',
      },
    ];
    expect((await checkTransaction(record)).status).toBe('mismatch');
  });

  it('handles strict-send destination fields, missing hashes and not-found transactions', async () => {
    const organization = Keypair.random().publicKey();
    const recipient = Keypair.random().publicKey();
    const record = {
      network: 'testnet' as const,
      txHash: 'b'.repeat(64),
      organizationWallet: organization,
      recipientWallet: recipient,
      amountStroops: '10000000',
      assetCode: 'XLM',
      assetIssuer: null,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/operations')) {
          return new Response(
            JSON.stringify({
              _embedded: {
                records: [
                  {
                    type: 'path_payment_strict_send',
                    from: organization,
                    to: recipient,
                    destination_amount: '1',
                    destination_asset_type: 'native',
                  },
                ],
              },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ successful: true, source_account: organization }), {
          status: 200,
        });
      }),
    );
    expect((await checkTransaction(record)).status).toBe('verified');
    expect((await checkTransaction({ ...record, txHash: '' })).status).toBe('unverified');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404 })),
    );
    expect((await checkTransaction(record)).status).toBe('not-found');
  });

  it('follows Horizon operation cursors and returns pending when the operation budget is exceeded', async () => {
    const organization = Keypair.random().publicKey();
    const recipient = Keypair.random().publicKey();
    const record = {
      network: 'testnet' as const,
      txHash: 'c'.repeat(64),
      organizationWallet: organization,
      recipientWallet: recipient,
      amountStroops: '10000000',
      assetCode: 'XLM',
      assetIssuer: null,
    };
    const other = Keypair.random().publicKey();
    const firstPage = Array.from({ length: 200 }, (_, index) => ({
      type: 'payment',
      from: organization,
      to: other,
      amount: '1',
      asset_type: 'native',
      paging_token: String(index + 1),
    }));
    let calls = 0;
    const horizonFetch = vi.fn(async (input) => {
      const url = new URL(String(input));
      if (!url.pathname.endsWith('/operations')) {
        return new Response(JSON.stringify({ successful: true, source_account: organization }), {
          status: 200,
        });
      }
      calls += 1;
      const records = url.searchParams.has('cursor')
        ? [
            {
              type: 'payment',
              from: organization,
              to: recipient,
              amount: '1',
              asset_type: 'native',
            },
          ]
        : firstPage;
      return new Response(JSON.stringify({ _embedded: { records } }), { status: 200 });
    });
    vi.stubGlobal('fetch', horizonFetch);
    expect((await checkTransaction(record)).status).toBe('verified');
    expect(calls).toBe(2);

    calls = 0;
    horizonFetch.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (!url.pathname.endsWith('/operations')) {
        return new Response(JSON.stringify({ successful: true, source_account: organization }), {
          status: 200,
        });
      }
      calls += 1;
      return new Response(JSON.stringify({ _embedded: { records: firstPage } }), { status: 200 });
    });
    expect((await checkTransaction(record)).status).toBe('pending');
    expect(calls).toBe(20);
  });

  it('captures the transaction memo as evidence without changing the matching result', async () => {
    const organization = Keypair.random().publicKey();
    const recipient = Keypair.random().publicKey();
    const record = {
      network: 'testnet' as const,
      txHash: 'd'.repeat(64),
      organizationWallet: organization,
      recipientWallet: recipient,
      amountStroops: '10000000',
      assetCode: 'XLM',
      assetIssuer: null,
    };
    let transaction: Record<string, unknown> = {};
    let operations: Record<string, unknown>[] = [];
    const matching = [
      { type: 'payment', from: organization, to: recipient, amount: '1', asset_type: 'native' },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input) => {
        const url = new URL(String(input));
        const body = url.pathname.endsWith('/operations')
          ? { _embedded: { records: operations } }
          : transaction;
        return new Response(JSON.stringify(body), { status: 200 });
      }),
    );
    const base = { successful: true, source_account: organization, ledger: 5 };
    operations = matching;

    transaction = { ...base, memo_type: 'text', memo: 'AID-2026-0042' };
    const text = await checkTransaction(record);
    expect(text.status).toBe('verified');
    expect(text).toMatchObject({ memo: 'AID-2026-0042', memoType: 'text' });

    // uint64 beyond Number.MAX_SAFE_INTEGER must survive exactly as a string.
    const largeId = '18446744073709551615';
    transaction = { ...base, memo_type: 'id', memo: largeId };
    const id = await checkTransaction(record);
    expect(id.status).toBe('verified');
    expect(id.memoType).toBe('id');
    expect(id.memo).toBe(largeId);
    expect(typeof id.memo).toBe('string');

    const base64Hash = Buffer.alloc(32, 0xab).toString('base64');
    transaction = { ...base, memo_type: 'hash', memo: base64Hash };
    expect(await checkTransaction(record)).toMatchObject({
      status: 'verified',
      memo: base64Hash,
      memoType: 'hash',
    });

    transaction = { ...base, memo_type: 'return', memo: base64Hash };
    expect(await checkTransaction(record)).toMatchObject({ memo: base64Hash, memoType: 'return' });

    for (const noMemo of [
      { ...base, memo_type: 'none' },
      { ...base },
      { ...base, memo_type: 'unknown', memo: 'ignored' },
      { ...base, memo_type: 'id', memo: 42 },
      { ...base, memo_type: 'text', memo: '' },
      { ...base, memo_type: 'text', memo: '\u0000\u0000' },
    ]) {
      transaction = noMemo;
      const result = await checkTransaction(record);
      expect(result.status).toBe('verified');
      expect(result).not.toHaveProperty('memo');
      expect(result).not.toHaveProperty('memoType');
    }

    transaction = { ...base, memo_type: 'text', memo: 'x'.repeat(500) };
    expect((await checkTransaction(record)).memo).toHaveLength(128);

    // PostgreSQL TEXT rejects NUL, so it is stripped before the memo can reach storage.
    transaction = { ...base, memo_type: 'text', memo: 'AID\u0000-0042' };
    expect((await checkTransaction(record)).memo).toBe('AID-0042');

    operations = [{ ...matching[0], to: Keypair.random().publicKey() }];
    transaction = { ...base, memo_type: 'text', memo: 'AID-2026-0042' };
    const mismatch = await checkTransaction(record);
    expect(mismatch.status).toBe('mismatch');
    expect(mismatch).toMatchObject({ memo: 'AID-2026-0042', memoType: 'text' });

    transaction = { ...base, successful: false, memo_type: 'text', memo: 'AID-2026-0042' };
    expect(await checkTransaction(record)).toMatchObject({
      status: 'mismatch',
      memo: 'AID-2026-0042',
      memoType: 'text',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404 })),
    );
    const notFound = await checkTransaction(record);
    expect(notFound.status).toBe('not-found');
    expect(notFound).not.toHaveProperty('memo');
  });

  it('bounds the Horizon response size and rejects a non-array operations payload', async () => {
    const organization = Keypair.random().publicKey();
    const recipient = Keypair.random().publicKey();
    const record = {
      network: 'testnet' as const,
      txHash: 'e'.repeat(64),
      organizationWallet: organization,
      recipientWallet: recipient,
      amountStroops: '12500000',
      assetCode: 'XLM',
      assetIssuer: null,
    };

    const oversizedFetch = vi.fn(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/operations')) {
        return new Response(JSON.stringify({ _embedded: { records: [] } }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          successful: true,
          source_account: organization,
          padding: 'x'.repeat(HORIZON_MAX_RESPONSE_BYTES),
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', oversizedFetch);
    expect((await checkTransaction(record)).status).toBe('pending');
    // The oversized transaction body is abandoned before the operations request is made.
    expect(oversizedFetch).toHaveBeenCalledTimes(1);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input) => {
        const url = new URL(String(input));
        return url.pathname.endsWith('/operations')
          ? new Response(JSON.stringify({ _embedded: { records: 'not-an-array' } }), {
              status: 200,
            })
          : new Response(JSON.stringify({ successful: true, source_account: organization }), {
              status: 200,
            });
      }),
    );
    expect((await checkTransaction(record)).status).toBe('pending');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input) => {
        const url = new URL(String(input));
        const body = url.pathname.endsWith('/operations')
          ? {
              _embedded: {
                records: [
                  {
                    type: 'payment',
                    from: organization,
                    to: recipient,
                    amount: '1.25',
                    asset_type: 'native',
                  },
                ],
              },
            }
          : {
              successful: true,
              source_account: organization,
              ledger: 21,
              created_at: '2026-01-01T00:00:00Z',
            };
        return new Response(JSON.stringify(body), { status: 200 });
      }),
    );
    expect(await checkTransaction(record)).toMatchObject({
      status: 'verified',
      ledger: 21,
      sourceAccount: organization,
      destination: recipient,
      amount: '1.25',
      asset: 'XLM',
    });
  });
});

describe('Per-IP rate-limit error contract', () => {
  function expectRateLimitContract(response: request.Response) {
    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      error: expect.any(String),
      code: 'rate_limit_exceeded',
    });
    expect(response.body.error.trim().length).toBeGreaterThan(0);
    expect(response.body.error).not.toBe('rate_limit_exceeded');
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
  }

  it('returns the documented 429 error contract across public read, auth, and API limiters', async () => {
    vi.resetModules();
    vi.stubEnv('PUBLIC_READ_RATE_LIMIT_MAX', '1');
    vi.stubEnv('AUTH_RATE_LIMIT_MAX', '1');
    vi.stubEnv('API_RATE_LIMIT_MAX', '3');

    const [{ app: rateLimitedApp }, { pool: rateLimitedPool }] = await Promise.all([
      import('../server/app.js'),
      import('../server/db.js'),
    ]);

    try {
      await request(rateLimitedApp).get('/api/transparency');
      const transparencyLimited = await request(rateLimitedApp).get('/api/transparency');
      expectRateLimitContract(transparencyLimited);

      const challengePayload = { address: 'invalid', network: 'testnet' };
      const authFirst = await request(rateLimitedApp)
        .post('/api/auth/challenge')
        .set('Origin', origin)
        .send(challengePayload);
      expect(authFirst.status).toBe(400);
      const authLimited = await request(rateLimitedApp)
        .post('/api/auth/challenge')
        .set('Origin', origin)
        .send(challengePayload);
      expectRateLimitContract(authLimited);

      const apiAllowed = await request(rateLimitedApp).get('/api/nonexistent-rate-limit-check');
      expect(apiAllowed.status).toBe(404);
      const apiLimited = await request(rateLimitedApp).get('/api/nonexistent-rate-limit-check');
      expectRateLimitContract(apiLimited);
    } finally {
      await rateLimitedPool.end();
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

const integration = describe.skipIf(!process.env.TEST_DATABASE_URL);

integration('Idle-in-transaction bound on the database', () => {
  it('applies the configured idle_in_transaction_session_timeout to pooled clients', async () => {
    const client = await pool.connect();
    try {
      const result = await client.query<{ idle_in_transaction_session_timeout: string }>(
        'SHOW idle_in_transaction_session_timeout',
      );
      expect(result.rows[0].idle_in_transaction_session_timeout).toBe(
        `${IDLE_IN_TRANSACTION_TIMEOUT_MS / 1000}s`,
      );
    } finally {
      client.release();
    }
  });

  it('terminates a client that runs BEGIN and then idles past the bound', async () => {
    // Same pool option as server/db.ts with a short bound so the test runs quickly.
    const short = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      idle_in_transaction_session_timeout: 500,
    });
    short.on('error', () => {});
    const client = await short.connect();
    client.on('error', () => {});
    let broken: Error | undefined;
    try {
      await client.query('BEGIN');
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      const started = Date.now();
      await expect(client.query('SELECT 1')).rejects.toThrow();
      expect(Date.now() - started).toBeLessThan(5_000);
      broken = new Error('session terminated by idle_in_transaction_session_timeout');
    } finally {
      client.release(broken);
      await short.end();
    }
  });
});

integration('Database-backed wallet, records, and authorization flows', () => {
  const wallets = new Set<string>();
  const recordIds = new Set<string>();
  let admin: Keypair;

  afterEach(() => vi.unstubAllGlobals());

  async function expectAuditEvent(
    action: string,
    actorWallet: string,
    expected: {
      subjectWallet?: string;
      recordId?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ) {
    const subjectWallet = expected.subjectWallet ?? null;
    const recordId = expected.recordId ?? null;
    const result = await pool.query<{
      action: string;
      actor_wallet: string;
      subject_wallet: string | null;
      record_id: string | null;
      metadata_json: Record<string, unknown>;
    }>(
      `SELECT action, actor_wallet, subject_wallet, record_id, metadata_json
       FROM audit_events
       WHERE action = $1 AND actor_wallet = $2
         AND subject_wallet IS NOT DISTINCT FROM $3
         AND record_id IS NOT DISTINCT FROM $4
       ORDER BY created_at DESC
       LIMIT 1`,
      [action, actorWallet, subjectWallet, recordId],
    );
    expect(result.rows[0], `Missing ${action} audit event for ${actorWallet}`).toMatchObject({
      action,
      actor_wallet: actorWallet,
      subject_wallet: subjectWallet,
      record_id: recordId,
      ...(expected.metadata ? { metadata_json: expected.metadata } : {}),
    });
  }

  async function login(wallet: Keypair) {
    const address = wallet.publicKey();
    wallets.add(address);
    const challenge = await request(app)
      .post('/api/auth/challenge')
      .set('Origin', origin)
      .send({ address, network: 'testnet' });
    expect(challenge.status).toBe(200);
    expect(typeof challenge.body.expiresAt).toBe('number');
    expect(challenge.body.expiresAt).toBeGreaterThan(Date.now());
    expect(challenge.body.expiresAt).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000);
    expect(challenge.body.message).toContain('Nonce: ');
    expect(challenge.body.message).toContain('Domain: http://localhost:5173');
    expect(challenge.body.message).toContain('Issued At: ');
    expect(challenge.body.message).toContain('Expires: ');
    expect(challenge.body.message).toContain('Purpose: prove wallet ownership');
    const issuedAt = Date.parse(challenge.body.message.match(/Issued At: ([^\n]+)/)?.[1] || '');
    expect(challenge.body.expiresAt - issuedAt).toBe(5 * 60 * 1000);

    const digest = createHash('sha256')
      .update('Stellar Signed Message:\n')
      .update(challenge.body.message)
      .digest();
    const signature = Buffer.from(wallet.sign(digest)).toString('base64');
    const verified = await request(app).post('/api/auth/verify').set('Origin', origin).send({
      challengeId: challenge.body.challengeId,
      address,
      network: 'testnet',
      signature,
    });
    expect(verified.status).toBe(200);
    const cookieHeader = verified.headers['set-cookie'];
    const cookieLine = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
    expect(cookieLine).toContain('HttpOnly');
    expect(cookieLine).toContain('Secure');
    expect(cookieLine).toContain('SameSite=Lax');
    expect(cookieLine).toContain('Max-Age=604800');
    const cookie = cookieLine?.split(';')[0];
    if (!cookie) throw new Error('Authentication response did not set a session cookie.');
    return {
      address,
      cookie,
      csrfToken: verified.body.session.csrfToken,
      challengeId: challenge.body.challengeId,
    };
  }

  async function assignRole(
    session: { cookie: string; csrfToken: string },
    wallet: Keypair,
    role: 'organization' | 'beneficiary' | 'donor' | 'admin',
  ) {
    wallets.add(wallet.publicKey());
    const result = await request(app)
      .post('/api/admin/roles')
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({ csrfToken: session.csrfToken, address: wallet.publicKey(), role });
    expect(result.status).toBe(200);
  }

  async function createRecord(
    session: { cookie: string; csrfToken: string },
    recipient: Keypair,
    purpose: string,
    options: { txHash?: string; consent?: boolean } = {},
  ) {
    const response = await request(app)
      .post('/api/records')
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({
        csrfToken: session.csrfToken,
        recipient: 'Confidential beneficiary',
        recipientAddress: recipient.publicKey(),
        purpose,
        amount: '1.25',
        asset: 'XLM',
        assetIssuer: '',
        network: 'testnet',
        txHash: options.txHash || '',
        date: '2026-01-15',
        note: 'Private contact note',
        recipientConsent: options.consent || false,
      });
    if (response.body.record?.id) recordIds.add(response.body.record.id);
    return response;
  }

  beforeAll(async () => {
    await migrate();
    admin = Keypair.random();
    wallets.add(admin.publicKey());
    await pool.query('INSERT INTO users (wallet_address) VALUES ($1) ON CONFLICT DO NOTHING', [
      admin.publicKey(),
    ]);
    await pool.query(
      `INSERT INTO wallet_roles (wallet_address, role, updated_by)
       VALUES ($1, 'admin', $1)
       ON CONFLICT (wallet_address) DO UPDATE SET role = 'admin', updated_by = EXCLUDED.updated_by`,
      [admin.publicKey()],
    );
  });

  afterAll(async () => {
    const addresses = [...wallets];
    const ids = [...recordIds];
    const maintenancePool = new Pool({
      connectionString: process.env.DATABASE_URL_UNPOOLED,
    });
    try {
      if (addresses.length) {
        await maintenancePool.query(
          `DELETE FROM audit_events
           WHERE actor_wallet = ANY($1::text[]) OR subject_wallet = ANY($1::text[])
              OR record_id = ANY($2::text[])`,
          [addresses, ids],
        );
        if (ids.length) {
          await maintenancePool.query(
            'DELETE FROM verification_results WHERE aid_record_id = ANY($1::text[])',
            [ids],
          );
          await maintenancePool.query('DELETE FROM aid_records WHERE id = ANY($1::text[])', [ids]);
        }
        await maintenancePool.query(
          'DELETE FROM organizations WHERE wallet_address = ANY($1::text[])',
          [addresses],
        );
        await maintenancePool.query(
          `DELETE FROM wallet_roles
           WHERE wallet_address = ANY($1::text[]) OR updated_by = ANY($1::text[])`,
          [addresses],
        );
        await maintenancePool.query('DELETE FROM sessions WHERE wallet_address = ANY($1::text[])', [
          addresses,
        ]);
        await maintenancePool.query(
          'DELETE FROM challenges WHERE wallet_address = ANY($1::text[])',
          [addresses],
        );
        await maintenancePool.query('DELETE FROM users WHERE wallet_address = ANY($1::text[])', [
          addresses,
        ]);
      }
    } finally {
      await maintenancePool.end();
      await pool.end();
    }
  });

  it('reports duplicate hashes and aborts migration 002 before creating the unique constraint', async () => {
    const client = await pool.connect();
    const hash = 'a'.repeat(64);
    try {
      await client.query('BEGIN');
      await client.query(
        'CREATE TEMP TABLE aid_records (id TEXT PRIMARY KEY, network TEXT NOT NULL, tx_hash TEXT)',
      );
      await client.query(
        'INSERT INTO aid_records (id, network, tx_hash) VALUES ($1, $2, $3), ($4, $2, $5)',
        ['duplicate-one', 'testnet', hash.toUpperCase(), 'duplicate-two', hash],
      );

      await expect(applyUniqueNetworkTxHashMigration(client)).rejects.toMatchObject({
        name: 'DuplicateTransactionHashesError',
        duplicates: [
          { id: 'duplicate-one', network: 'testnet', duplicate_count: '2' },
          { id: 'duplicate-two', network: 'testnet', duplicate_count: '2' },
        ],
      });

      const constraint = await client.query(
        `SELECT 1 FROM pg_constraint
         WHERE conrelid = 'pg_temp.aid_records'::regclass
           AND conname = 'aid_records_network_tx_hash_unique'`,
      );
      expect(constraint.rowCount).toBe(0);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('should have an index for wallet_roles sorting by updated_at DESC and wallet_address DESC', async () => {
    const result = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'wallet_roles'`,
    );
    expect(
      result.rows.some(({ indexdef }) =>
        indexdef.includes('btree (updated_at DESC, wallet_address DESC)'),
      ),
    ).toBe(true);
  });

  it('allows the runtime role to append and read audit events but not update or delete them', async () => {
    const identity = await pool.query<{ current_user: string; session_user: string }>(
      'SELECT current_user, session_user',
    );
    expect(identity.rows[0]).toEqual({
      current_user: 'aidtrace_runtime',
      session_user: 'aidtrace_runtime',
    });

    const id = `audit-append-only-${randomUUID()}`;
    await pool.query(
      `INSERT INTO audit_events (id, action, actor_wallet, summary)
       VALUES ($1, 'append_only_access_test', $2, 'runtime insert/read privilege check')`,
      [id, admin.publicKey()],
    );

    const inserted = await pool.query<{ action: string; summary: string }>(
      'SELECT action, summary FROM audit_events WHERE id = $1',
      [id],
    );
    expect(inserted.rows).toEqual([
      {
        action: 'append_only_access_test',
        summary: 'runtime insert/read privilege check',
      },
    ]);

    await expect(
      pool.query('UPDATE audit_events SET summary = $2 WHERE id = $1', [id, 'modified']),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(pool.query('DELETE FROM audit_events WHERE id = $1', [id])).rejects.toMatchObject({
      code: '42501',
    });
  });

  it('creates a single-use wallet session, enforces CSRF, expires challenges, and logs out', async () => {
    const wallet = Keypair.random();
    const session = await login(wallet);
    const me = await request(app).get('/api/me').set('Cookie', session.cookie);
    expect(me.body.session.address).toBe(wallet.publicKey());
    expect(me.body.session.role).toBe('donor');

    const missingCsrf = await request(app)
      .post('/api/auth/logout')
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({});
    expect(missingCsrf.status).toBe(403);

    const replayDigest = createHash('sha256')
      .update('Stellar Signed Message:\n')
      .update(
        (
          await pool.query<{ signed_message: string }>(
            'SELECT signed_message FROM challenges WHERE challenge_id = $1',
            [session.challengeId],
          )
        ).rows[0]!.signed_message,
      )
      .digest();
    const replaySignature = Buffer.from(wallet.sign(replayDigest)).toString('base64');
    const replay = await request(app).post('/api/auth/verify').set('Origin', origin).send({
      challengeId: session.challengeId,
      address: wallet.publicKey(),
      network: 'testnet',
      signature: replaySignature,
    });
    expect(replay.status).toBe(409);

    const expiredWallet = Keypair.random();
    const expired = await request(app)
      .post('/api/auth/challenge')
      .set('Origin', origin)
      .send({ address: expiredWallet.publicKey(), network: 'testnet' });
    wallets.add(expiredWallet.publicKey());
    await pool.query(
      "UPDATE challenges SET expires_at = NOW() - INTERVAL '1 second' WHERE challenge_id = $1",
      [expired.body.challengeId],
    );
    const expiredDigest = createHash('sha256')
      .update('Stellar Signed Message:\n')
      .update(expired.body.message)
      .digest();
    const expiredVerification = await request(app)
      .post('/api/auth/verify')
      .set('Origin', origin)
      .send({
        challengeId: expired.body.challengeId,
        address: expiredWallet.publicKey(),
        network: 'testnet',
        signature: Buffer.from(expiredWallet.sign(expiredDigest)).toString('base64'),
      });
    expect(expiredVerification.status).toBe(401);

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({ csrfToken: session.csrfToken });
    expect(logout.status).toBe(200);
    expect(logout.headers['set-cookie']?.[0]).toContain('Max-Age=0');
    expect(
      (await request(app).get('/api/me').set('Cookie', session.cookie)).body.session,
    ).toBeNull();
  });

  it('records throttled session activity and rejects expired or revoked sessions', async () => {
    const wallet = Keypair.random();
    const session = await login(wallet);
    const token = decodeURIComponent(session.cookie.slice('aidtrace_session='.length));
    const sessionHash = createHash('sha256').update(token).digest('hex');
    const lastSeen = async () =>
      (
        await pool.query<{ last_seen_at: Date | null }>(
          'SELECT last_seen_at FROM sessions WHERE session_hash = $1',
          [sessionHash],
        )
      ).rows[0]?.last_seen_at ?? null;
    const cookieRequest = (cookie: string) =>
      ({
        get: (name: string) => (name.toLowerCase() === 'cookie' ? cookie : undefined),
      }) as unknown as Parameters<typeof getSession>[0];

    expect(await lastSeen()).toBeNull();
    const first = await request(app).get('/api/me').set('Cookie', session.cookie);
    expect(first.body.session.address).toBe(wallet.publicKey());
    const firstSeen = await lastSeen();
    expect(firstSeen).not.toBeNull();

    const second = await request(app).get('/api/me').set('Cookie', session.cookie);
    expect(second.status).toBe(200);
    expect((await lastSeen())?.getTime()).toBe(firstSeen?.getTime());

    await pool.query(
      "UPDATE sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE session_hash = $1",
      [sessionHash],
    );
    expect(await getSession(cookieRequest(session.cookie))).toBeNull();
    expect(
      (await request(app).get('/api/me').set('Cookie', session.cookie)).body.session,
    ).toBeNull();

    const revokedSession = await login(Keypair.random());
    const revokedToken = decodeURIComponent(
      revokedSession.cookie.slice('aidtrace_session='.length),
    );
    await pool.query('UPDATE sessions SET revoked_at = NOW() WHERE session_hash = $1', [
      createHash('sha256').update(revokedToken).digest('hex'),
    ]);
    expect(await getSession(cookieRequest(revokedSession.cookie))).toBeNull();

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Origin', origin)
      .set('Cookie', revokedSession.cookie)
      .send({ csrfToken: revokedSession.csrfToken });
    expect(logout.status).toBe(200);
    const clearedCookie = String(logout.headers['set-cookie']);
    expect(clearedCookie).toContain('aidtrace_session=;');
    expect(clearedCookie).toContain('Max-Age=0');
  }, 60_000);

  it('verifies the matching source, stores evidence, and rejects duplicate network hashes', async () => {
    const adminSession = await login(admin);
    const organization = Keypair.random();
    await assignRole(adminSession, organization, 'organization');
    const recipient = Keypair.random();
    const session = await login(organization);
    const expectedSource = organization.publicKey();
    const transactionBodies = new Map<string, Record<string, unknown>>();
    const operationBodies = new Map<string, Record<string, unknown>[]>();
    const horizonFetch = vi.fn(async (input) => {
      const url = new URL(String(input));
      const pathSegments = url.pathname.split('/').filter(Boolean);
      const hash = pathSegments[pathSegments.indexOf('transactions') + 1] || '';
      if (url.pathname.endsWith('/operations')) {
        return new Response(
          JSON.stringify({ _embedded: { records: operationBodies.get(hash) || [] } }),
          { status: 200 },
        );
      }
      const transaction = transactionBodies.get(hash);
      return transaction
        ? new Response(JSON.stringify(transaction), { status: 200 })
        : new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', horizonFetch);

    const verifiedHash = '1'.padStart(64, '0');
    transactionBodies.set(verifiedHash, {
      successful: true,
      source_account: expectedSource,
      ledger: 7,
      created_at: '2026-01-15T00:00:00Z',
    });
    operationBodies.set(verifiedHash, [
      {
        type: 'payment',
        from: expectedSource,
        to: recipient.publicKey(),
        amount: '1.25',
        asset_type: 'native',
      },
    ]);
    const verified = await createRecord(session, recipient, 'Summary test verified', {
      txHash: verifiedHash,
    });
    expect(verified.status).toBe(201);
    expect(verified.body.record.status).toBe('verified');
    expect(verified.body.record.verification.sourceAccount).toBe(expectedSource);
    const cached = await request(app)
      .post('/api/records/' + verified.body.record.id + '/verify')
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({ csrfToken: session.csrfToken });
    expect(cached.status).toBe(200);
    expect(horizonFetch).toHaveBeenCalledTimes(2);
    const editAfterVerify = await request(app)
      .put('/api/records/' + verified.body.record.id)
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({
        csrfToken: session.csrfToken,
        recipient: cached.body.record.recipient,
        recipientAddress: cached.body.record.recipientAddress,
        purpose: cached.body.record.purpose,
        amount: cached.body.record.amount,
        asset: cached.body.record.asset,
        assetIssuer: cached.body.record.assetIssuer,
        network: cached.body.record.network,
        txHash: cached.body.record.txHash,
        date: cached.body.record.date,
        note: cached.body.record.note,
        recipientConsent: cached.body.record.recipientConsent,
      });
    expect(editAfterVerify.status).toBe(200);

    const wrongHash = '2'.padStart(64, '0');
    transactionBodies.set(wrongHash, {
      successful: true,
      source_account: expectedSource,
      ledger: 8,
      created_at: '2026-01-15T00:00:00Z',
    });
    operationBodies.set(wrongHash, [
      {
        type: 'payment',
        from: Keypair.random().publicKey(),
        to: recipient.publicKey(),
        amount: '1.25',
        asset_type: 'native',
      },
    ]);
    const mismatch = await createRecord(session, recipient, 'Summary test mismatch', {
      txHash: wrongHash,
    });
    expect(mismatch.status).toBe(201);
    expect(mismatch.body.record.status).toBe('mismatch');
    expect(mismatch.body.record.verification).toMatchObject({
      sourceAccount: expect.not.stringMatching(expectedSource),
      destination: recipient.publicKey(),
      amount: '1.25',
      asset: 'XLM',
    });

    const adminHash = '4'.padStart(64, '0');
    transactionBodies.set(adminHash, {
      successful: true,
      source_account: admin.publicKey(),
      ledger: 9,
      created_at: '2026-01-15T00:00:00Z',
    });
    operationBodies.set(adminHash, [
      {
        type: 'payment',
        from: admin.publicKey(),
        to: recipient.publicKey(),
        amount: '1.25',
        asset_type: 'native',
      },
    ]);
    const adminCreated = await createRecord(adminSession, recipient, 'Admin-created record', {
      txHash: adminHash,
    });
    expect(adminCreated.status).toBe(201);
    expect(adminCreated.body.record.organization).toBe(admin.publicKey());
    expect(adminCreated.body.record.organizationName).toBe(
      'Organization ' + admin.publicKey().slice(-4),
    );
    expect(adminCreated.body.record.verification.sourceAccount).toBe(admin.publicKey());

    const summaryResponse = await request(app)
      .get('/api/transparency')
      .query({ q: 'Summary test' });
    expect(summaryResponse.status).toBe(200);
    const publicMismatch = summaryResponse.body.records.find(
      (record: { id: string }) => record.id === mismatch.body.record.id,
    );
    expect(publicMismatch.recipientAddress).toBe('');
    expect(publicMismatch.verification.destination).toBeUndefined();
    expect(publicMismatch.verification).toMatchObject({
      sourceAccount: mismatch.body.record.verification.sourceAccount,
      amount: '1.25',
      asset: 'XLM',
    });
    expect(summaryResponse.body.summary.byStatus).toEqual([
      { status: 'mismatch', asset: 'XLM', amount: '1.25' },
      { status: 'verified', asset: 'XLM', amount: '1.25' },
    ]);

    const duplicate = await createRecord(session, recipient, 'Duplicate record', {
      txHash: verifiedHash,
    });
    expect(duplicate.status).toBe(409);
  }, 120_000);

  it('stores the transaction memo and withholds it from consent-off public views', async () => {
    const adminSession = await login(admin);
    const organization = Keypair.random();
    const otherOrganization = Keypair.random();
    const recipient = Keypair.random();
    await assignRole(adminSession, organization, 'organization');
    await assignRole(adminSession, otherOrganization, 'organization');
    const session = await login(organization);
    const otherSession = await login(otherOrganization);
    const term = 'memo-' + Keypair.random().publicKey().slice(-8);
    const memo = 'AID-' + Keypair.random().publicKey().slice(-12);
    const privateHash = createHash('sha256')
      .update(term + '-private')
      .digest('hex');
    const consentHash = createHash('sha256')
      .update(term + '-consent')
      .digest('hex');
    const largeId = '18446744073709551615';
    const transactions = new Map<string, Record<string, unknown>>();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input) => {
        const url = new URL(String(input));
        const segments = url.pathname.split('/').filter(Boolean);
        const hash = segments[segments.indexOf('transactions') + 1] || '';
        const transaction = transactions.get(hash);
        if (!transaction) return new Response('{}', { status: 404 });
        const records = url.pathname.endsWith('/operations')
          ? [
              {
                type: 'payment',
                from: organization.publicKey(),
                to: recipient.publicKey(),
                amount: '1.25',
                asset_type: 'native',
              },
            ]
          : undefined;
        return new Response(JSON.stringify(records ? { _embedded: { records } } : transaction), {
          status: 200,
        });
      }),
    );

    // Created while Horizon returns 404, so the explicit verify call below is not cached.
    const created = await createRecord(session, recipient, term + ' private', {
      txHash: privateHash,
    });
    expect(created.status).toBe(201);
    expect(created.body.record.status).toBe('not-found');
    expect(created.body.record.verification).not.toHaveProperty('memo');
    const recordId = created.body.record.id;

    transactions.set(privateHash, {
      successful: true,
      source_account: organization.publicKey(),
      ledger: 11,
      created_at: '2026-01-15T00:00:00Z',
      memo_type: 'text',
      memo,
    });
    const verified = await request(app)
      .post('/api/records/' + recordId + '/verify')
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({ csrfToken: session.csrfToken });
    expect(verified.status).toBe(200);
    expect(verified.body.record.status).toBe('verified');
    expect(verified.body.record.verification).toMatchObject({ memo, memoType: 'text' });

    const stored = await pool.query<{ memo: string | null; memo_type: string | null }>(
      `SELECT memo, memo_type FROM verification_results
       WHERE aid_record_id = $1 ORDER BY checked_at DESC, id DESC LIMIT 1`,
      [recordId],
    );
    expect(stored.rows[0]).toEqual({ memo, memo_type: 'text' });
    await expectAuditEvent('record_verification_checked', session.address, {
      recordId,
      metadata: { status: 'verified', ledger: 11 },
    });

    const findRecord = (body: { records: { id: string }[] }) =>
      body.records.find((record) => record.id === recordId) as
        { verification?: Record<string, unknown> } | undefined;

    const ownerView = await request(app)
      .get('/api/transparency')
      .query({ q: term })
      .set('Cookie', session.cookie);
    expect(ownerView.status).toBe(200);
    expect(findRecord(ownerView.body)?.verification).toMatchObject({ memo, memoType: 'text' });

    const adminView = await request(app)
      .get('/api/transparency')
      .query({ q: term })
      .set('Cookie', adminSession.cookie);
    expect(findRecord(adminView.body)?.verification).toMatchObject({ memo, memoType: 'text' });

    for (const publicView of [
      await request(app).get('/api/transparency').query({ q: term }),
      await request(app)
        .get('/api/transparency')
        .query({ q: term })
        .set('Cookie', otherSession.cookie),
    ]) {
      expect(publicView.status).toBe(200);
      const publicRecord = findRecord(publicView.body);
      expect(publicRecord?.verification?.status).toBe('verified');
      expect(publicRecord?.verification).not.toHaveProperty('memo');
      expect(publicRecord?.verification).not.toHaveProperty('memoType');
      expect(JSON.stringify(publicView.body)).not.toContain(memo);
    }

    await assignRole(adminSession, recipient, 'beneficiary');
    const beneficiarySession = await login(recipient);
    const beneficiaryView = await request(app)
      .get('/api/beneficiary')
      .query({ q: term })
      .set('Cookie', beneficiarySession.cookie);
    expect(beneficiaryView.status).toBe(200);
    expect(findRecord(beneficiaryView.body)?.verification).toMatchObject({
      memo,
      memoType: 'text',
    });

    // With consent the public projection includes the full record, memo included; a uint64 id
    // memo above 2^53 round-trips through the TEXT column unchanged.
    transactions.set(consentHash, {
      successful: true,
      source_account: organization.publicKey(),
      memo_type: 'id',
      memo: largeId,
    });
    const consented = await createRecord(session, recipient, term + ' consented', {
      txHash: consentHash,
      consent: true,
    });
    expect(consented.status).toBe(201);
    expect(consented.body.record.verification).toMatchObject({ memo: largeId, memoType: 'id' });
    const consentedPublic = await request(app)
      .get('/api/transparency')
      .query({ q: term + ' consented' });
    expect(consentedPublic.body.records[0].verification).toMatchObject({
      memo: largeId,
      memoType: 'id',
    });
  }, 120_000);

  it('returns a filter-bounded total on transparency pages without walking every record', async () => {
    const adminSession = await login(admin);
    const organization = Keypair.random();
    await assignRole(adminSession, organization, 'organization');
    const session = await login(organization);
    const recipient = Keypair.random();
    const token = 'bounded-total-' + Date.now();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404 })),
    );
    for (let index = 0; index < 3; index += 1) {
      const created = await createRecord(session, recipient, `${token} case ${index}`, {
        txHash: createHash('sha256').update(`${token}-${index}`).digest('hex'),
      });
      expect(created.status).toBe(201);
    }

    const pageOne = await request(app).get('/api/transparency').query({ q: token, limit: '1' });
    expect(pageOne.status).toBe(200);
    expect(pageOne.body.records).toHaveLength(1);
    expect(pageOne.body.total).toBe(3);
    expect(pageOne.body.hasMore).toBe(true);
    expect(typeof pageOne.body.nextCursor).toBe('string');

    const pageTwo = await request(app)
      .get('/api/transparency')
      .query({ q: token, limit: '1', cursor: pageOne.body.nextCursor });
    expect(pageTwo.status).toBe(200);
    expect(pageTwo.body.records).toHaveLength(1);
    expect(pageTwo.body.total).toBe(3);
    expect(pageTwo.body.records[0].id).not.toBe(pageOne.body.records[0].id);

    const tight = await request(app)
      .get('/api/transparency')
      .query({ q: `${token} case 1`, limit: '1' });
    expect(tight.status).toBe(200);
    expect(tight.body.total).toBe(1);
    expect(tight.body.hasMore).toBe(false);
  }, 120_000);

  it('paginates and filters public records while redacting beneficiary identifiers by default', async () => {
    const adminSession = await login(admin);
    const organization = Keypair.random();
    await assignRole(adminSession, organization, 'organization');
    const session = await login(organization);
    const recipient = Keypair.random();
    const privacyTerm = 'privacy-' + Keypair.random().publicKey().slice(-8);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404 })),
    );
    const privateRecord = await createRecord(session, recipient, privacyTerm, {
      txHash: '3'.padStart(64, '0'),
    });
    expect(privateRecord.status).toBe(201);

    const publicResponse = await request(app)
      .get('/api/transparency')
      .query({ q: privacyTerm, network: 'testnet', limit: '1' });
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.records).toHaveLength(1);
    expect(publicResponse.body.facets.organizations).toContain(organization.publicKey());
    expect(publicResponse.body.records[0].recipient).toMatch(/^Beneficiary-/);
    expect(publicResponse.body.records[0].recipient).toBe(
      'Beneficiary-' +
        createHmac('sha256', process.env.PSEUDONYM_SECRET || '')
          .update('aidtrace-beneficiary:')
          .update(recipient.publicKey())
          .digest('hex')
          .slice(0, 12),
    );
    expect(publicResponse.body.records[0].recipient).not.toBe(
      'Beneficiary-' +
        createHmac('sha256', process.env.SESSION_SECRET || '')
          .update('aidtrace-beneficiary:')
          .update(recipient.publicKey())
          .digest('hex')
          .slice(0, 12),
    );
    expect(publicResponse.body.records[0].recipient).not.toContain(
      createHash('sha256').update(recipient.publicKey()).digest('hex').slice(0, 12),
    );
    expect(publicResponse.body.records[0].recipientAddress).toBe('');
    expect(publicResponse.body.records[0].txHash).toBe('');
    expect(publicResponse.body.records[0].note).toBe('');

    const singlePublicResponse = await request(app).get(
      '/api/records/' + encodeURIComponent(privateRecord.body.record.id),
    );
    expect(singlePublicResponse.status).toBe(200);
    expect(singlePublicResponse.body.record).toEqual(publicResponse.body.records[0]);
    expect(singlePublicResponse.body.record.recipientAddress).toBe('');
    expect(singlePublicResponse.body.record.txHash).toBe('');
    expect(singlePublicResponse.body.record.note).toBe('');

    const missingRecord = await request(app).get('/api/records/not-a-record');
    expect(missingRecord.status).toBe(404);
    expect(missingRecord.body).toEqual({ error: 'Record not found.' });

    const ownerResponse = await request(app)
      .get('/api/transparency')
      .query({ q: privacyTerm })
      .set('Cookie', session.cookie);
    expect(ownerResponse.body.records[0].recipient).toBe('Confidential beneficiary');
    expect(ownerResponse.body.records[0].recipientAddress).toBe(recipient.publicKey());
    expect(ownerResponse.body.records[0].txHash).toBe('3'.padStart(64, '0'));
    expect(ownerResponse.body.records[0].note).toBe('Private contact note');

    const adminResponse = await request(app)
      .get('/api/transparency')
      .query({ q: privacyTerm })
      .set('Cookie', adminSession.cookie);
    expect(adminResponse.body.records[0].recipient).toBe('Confidential beneficiary');
    expect(adminResponse.body.records[0].recipientAddress).toBe(recipient.publicKey());
    expect(adminResponse.body.records[0].note).toBe('Private contact note');

    await assignRole(adminSession, recipient, 'beneficiary');
    const beneficiarySession = await login(recipient);
    const beneficiaryResponse = await request(app)
      .get('/api/beneficiary')
      .query({ q: privacyTerm })
      .set('Cookie', beneficiarySession.cookie);
    expect(beneficiaryResponse.body.records).toHaveLength(1);
    expect(beneficiaryResponse.body.records[0].recipient).toBe('Confidential beneficiary');
    expect(beneficiaryResponse.body.records[0].recipientAddress).toBe(recipient.publicKey());
    expect(beneficiaryResponse.body.records[0].note).toBe('Private contact note');

    const secondTerm = privacyTerm + ' repeat';
    const secondPrivateRecord = await createRecord(session, recipient, secondTerm, {
      txHash: createHash('sha256')
        .update('second-' + recipient.publicKey())
        .digest('hex'),
    });
    expect(secondPrivateRecord.status).toBe(201);
    const secondPublicResponse = await request(app)
      .get('/api/transparency')
      .query({ q: secondTerm, network: 'testnet', limit: '1' });
    expect(secondPublicResponse.body.records[0].recipient).toBe(
      publicResponse.body.records[0].recipient,
    );

    const pageOne = await request(app).get('/api/transparency').query({ limit: '1' });
    expect(pageOne.body.hasMore).toBe(true);
    const pageTwo = await request(app)
      .get('/api/transparency')
      .query({ limit: '1', cursor: pageOne.body.nextCursor });
    expect(pageTwo.status).toBe(200);
    expect(pageTwo.body.records[0].id).not.toBe(pageOne.body.records[0].id);
    const wrongFilterCursor = await request(app)
      .get('/api/transparency')
      .query({ limit: '1', network: 'testnet', cursor: pageOne.body.nextCursor });
    expect(wrongFilterCursor.status).toBe(400);
  }, 120_000);

  it('enforces organization ownership, beneficiary scoping, void history, admin roles, and logout-everywhere', async () => {
    const adminSession = await login(admin);
    const organization = Keypair.random();
    const otherOrganization = Keypair.random();
    const beneficiary = Keypair.random();
    await assignRole(adminSession, organization, 'organization');
    await assignRole(adminSession, otherOrganization, 'organization');
    await assignRole(adminSession, beneficiary, 'beneficiary');
    const roles = await request(app).get('/api/admin/roles').set('Cookie', adminSession.cookie);
    expect(
      roles.body.roles.some(
        (role: { id: string; address: string }) =>
          role.id === beneficiary.publicKey() && role.address === beneficiary.publicKey(),
      ),
    ).toBe(true);
    const ownerSession = await login(organization);
    const otherSession = await login(otherOrganization);
    const beneficiarySession = await login(beneficiary);

    const donor = Keypair.random();
    wallets.add(donor.publicKey());
    const donorSession = await login(donor);
    const forbiddenCreate = await createRecord(donorSession, beneficiary, 'Forbidden record');
    expect(forbiddenCreate.status).toBe(403);

    const owned = await createRecord(ownerSession, beneficiary, 'Owner record');
    const foreign = await createRecord(otherSession, Keypair.random(), 'Foreign record');
    expect(owned.status).toBe(201);
    expect(foreign.status).toBe(201);

    const crossOrganizationEdit = await request(app)
      .put('/api/records/' + owned.body.record.id)
      .set('Origin', origin)
      .set('Cookie', otherSession.cookie)
      .send({
        csrfToken: otherSession.csrfToken,
        recipient: 'Changed',
        recipientAddress: beneficiary.publicKey(),
        purpose: 'Attempted cross-organization edit',
        amount: '1.25',
        asset: 'XLM',
        assetIssuer: '',
        network: 'testnet',
        txHash: '',
        date: '2026-01-15',
        note: '',
      });
    expect(crossOrganizationEdit.status).toBe(403);

    const beneficiaryRecords = await request(app)
      .get('/api/beneficiary')
      .set('Cookie', beneficiarySession.cookie);
    expect(beneficiaryRecords.status).toBe(200);
    expect(beneficiaryRecords.body.records).toHaveLength(1);
    expect(
      beneficiaryRecords.body.records.every(
        (record: { recipientAddress: string }) =>
          record.recipientAddress === beneficiary.publicKey(),
      ),
    ).toBe(true);

    const noCsrfVoid = await request(app)
      .post('/api/records/' + owned.body.record.id + '/void')
      .set('Origin', origin)
      .set('Cookie', ownerSession.cookie)
      .send({ reason: 'Void this record' });
    expect(noCsrfVoid.status).toBe(403);

    const voided = await request(app)
      .post('/api/records/' + owned.body.record.id + '/void')
      .set('Origin', origin)
      .set('Cookie', ownerSession.cookie)
      .send({ csrfToken: ownerSession.csrfToken, reason: 'Duplicate entry' });
    expect(voided.status).toBe(200);
    expect(voided.body.record.status).toBe('voided');
    expect(voided.body.record.voidReason).toBe('Duplicate entry');
    expect(voided.body.record.voidedAt).toBeTruthy();
    const visibleVoid = await request(app)
      .get('/api/transparency')
      .query({ status: 'voided', q: 'Owner record' });
    expect(
      visibleVoid.body.records.some((record: { id: string }) => record.id === owned.body.record.id),
    ).toBe(true);

    const audit = await request(app)
      .get('/api/audit')
      .query({ action: 'record_voided' })
      .set('Cookie', adminSession.cookie);
    expect(audit.status).toBe(200);
    expect(
      audit.body.entries.some(
        (event: { recordId?: string }) => event.recordId === owned.body.record.id,
      ),
    ).toBe(true);
    await expectAuditEvent('record_voided', ownerSession.address, {
      recordId: owned.body.record.id,
      metadata: { voidReason: 'Duplicate entry' },
    });
    const sessionToken = ownerSession.cookie.slice(ownerSession.cookie.indexOf('=') + 1);
    const leakedSecrets = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM audit_events
       WHERE actor_wallet = $1
         AND (strpos(summary, $2) > 0 OR strpos(metadata_json::text, $2) > 0
              OR strpos(summary, $3) > 0 OR strpos(metadata_json::text, $3) > 0)`,
      [ownerSession.address, sessionToken, ownerSession.csrfToken],
    );
    expect(Number(leakedSecrets.rows[0].count)).toBe(0);

    const removable = Keypair.random();
    await assignRole(adminSession, removable, 'donor');
    const removed = await request(app)
      .delete('/api/admin/roles/' + encodeURIComponent(removable.publicKey()))
      .set('Origin', origin)
      .set('Cookie', adminSession.cookie)
      .send({ csrfToken: adminSession.csrfToken });
    expect(removed.status).toBe(200);

    const selfRemove = await request(app)
      .delete('/api/admin/roles/' + encodeURIComponent(admin.publicKey()))
      .set('Origin', origin)
      .set('Cookie', adminSession.cookie)
      .send({ csrfToken: adminSession.csrfToken });
    expect(selfRemove.status).toBe(409);

    const logoutEverywhere = await request(app)
      .post('/api/auth/logout-everywhere')
      .set('Origin', origin)
      .set('Cookie', ownerSession.cookie)
      .send({ csrfToken: ownerSession.csrfToken });
    expect(logoutEverywhere.status).toBe(200);
    expect(
      (await request(app).get('/api/me').set('Cookie', ownerSession.cookie)).body.session,
    ).toBeNull();
  }, 120_000);

  it('revokes every session for one wallet on logout-everywhere without touching other wallets', async () => {
    const wallet = Keypair.random();
    const otherWallet = Keypair.random();
    const firstSession = await login(wallet);
    const secondSession = await login(wallet);
    const otherWalletSession = await login(otherWallet);
    expect(firstSession.cookie).not.toBe(secondSession.cookie);

    const firstMe = await request(app).get('/api/me').set('Cookie', firstSession.cookie);
    const secondMe = await request(app).get('/api/me').set('Cookie', secondSession.cookie);
    expect(firstMe.body.session.address).toBe(wallet.publicKey());
    expect(secondMe.body.session.address).toBe(wallet.publicKey());

    const logoutEverywhere = await request(app)
      .post('/api/auth/logout-everywhere')
      .set('Origin', origin)
      .set('Cookie', firstSession.cookie)
      .send({ csrfToken: firstSession.csrfToken });
    expect(logoutEverywhere.status).toBe(200);

    expect(
      (await request(app).get('/api/me').set('Cookie', firstSession.cookie)).body.session,
    ).toBeNull();
    expect(
      (await request(app).get('/api/me').set('Cookie', secondSession.cookie)).body.session,
    ).toBeNull();
    const otherWalletMe = await request(app)
      .get('/api/me')
      .set('Cookie', otherWalletSession.cookie);
    expect(otherWalletMe.body.session.address).toBe(otherWallet.publicKey());

    await expectAuditEvent('wallet_logout_everywhere', wallet.publicKey());
  }, 60_000);

  it('enforces the authorization matrix for every protected route', async () => {
    const adminSession = await login(admin);
    const donorWallet = Keypair.random();
    const beneficiaryWallet = Keypair.random();
    const organizationWallet = Keypair.random();
    await assignRole(adminSession, beneficiaryWallet, 'beneficiary');
    await assignRole(adminSession, organizationWallet, 'organization');
    const donorSession = await login(donorWallet);
    const beneficiarySession = await login(beneficiaryWallet);
    const organizationSession = await login(organizationWallet);

    type Session = Awaited<ReturnType<typeof login>>;
    type MatrixRecord = {
      id: string;
      recipient: string;
      recipientAddress: string;
      purpose: string;
      amount: string;
      asset: string;
      assetIssuer?: string;
      network: 'testnet' | 'mainnet';
      txHash: string;
      date: string;
      note: string;
      recipientConsent?: boolean;
    };
    type Route = {
      name: string;
      method: 'get' | 'post' | 'put';
      path: string | ((recordId: string) => string);
      allowed: string[];
      write?: boolean;
      record?: boolean;
      body?: (session: Session, record: MatrixRecord | null) => Record<string, unknown>;
    };

    const principals: { name: string; session: Session | null; role: string | null }[] = [
      { name: 'anonymous', session: null, role: null },
      { name: 'donor', session: donorSession, role: 'donor' },
      { name: 'beneficiary', session: beneficiarySession, role: 'beneficiary' },
      { name: 'organization', session: organizationSession, role: 'organization' },
      { name: 'admin', session: adminSession, role: 'admin' },
    ];

    const routes: Route[] = [
      {
        name: 'GET /api/beneficiary',
        method: 'get',
        path: '/api/beneficiary',
        allowed: ['beneficiary', 'admin'],
      },
      { name: 'GET /api/admin/roles', method: 'get', path: '/api/admin/roles', allowed: ['admin'] },
      { name: 'GET /api/audit', method: 'get', path: '/api/audit', allowed: ['admin'] },
      {
        name: 'POST /api/records',
        method: 'post',
        path: '/api/records',
        allowed: ['organization', 'admin'],
        write: true,
        body: (session) => ({
          csrfToken: session.csrfToken,
          recipient: 'Matrix recipient',
          recipientAddress: Keypair.random().publicKey(),
          purpose: 'Authorization matrix create ' + Keypair.random().publicKey().slice(-8),
          amount: '1.25',
          asset: 'XLM',
          assetIssuer: '',
          network: 'testnet',
          txHash: '',
          date: '2026-01-15',
          note: '',
          recipientConsent: false,
        }),
      },
      {
        name: 'PUT /api/records/:id',
        method: 'put',
        path: (recordId) => '/api/records/' + recordId,
        allowed: ['organization', 'admin'],
        write: true,
        record: true,
        body: (session, record) => ({
          csrfToken: session.csrfToken,
          recipient: record!.recipient,
          recipientAddress: record!.recipientAddress,
          purpose: record!.purpose,
          amount: record!.amount,
          asset: record!.asset,
          assetIssuer: record!.assetIssuer || '',
          network: record!.network,
          txHash: record!.txHash,
          date: record!.date,
          note: record!.note,
          recipientConsent: record!.recipientConsent || false,
        }),
      },
      {
        // Verification accepts any authenticated session, so this route has no wrong-role 403.
        name: 'POST /api/records/:id/verify',
        method: 'post',
        path: (recordId) => '/api/records/' + recordId + '/verify',
        allowed: ['donor', 'beneficiary', 'organization', 'admin'],
        write: true,
        record: true,
        body: (session) => ({ csrfToken: session.csrfToken }),
      },
      {
        name: 'POST /api/records/:id/void',
        method: 'post',
        path: (recordId) => '/api/records/' + recordId + '/void',
        allowed: ['organization', 'admin'],
        write: true,
        record: true,
        body: (session) => ({ csrfToken: session.csrfToken, reason: 'Authorization matrix void' }),
      },
    ];

    const send = (method: Route['method'], path: string) =>
      method === 'get'
        ? request(app).get(path)
        : method === 'post'
          ? request(app).post(path)
          : request(app).put(path);

    for (const route of routes) {
      for (const principal of principals) {
        const label = route.name + ' as ' + principal.name;
        let record: MatrixRecord | null = null;
        if (route.record) {
          const created = await createRecord(
            organizationSession,
            Keypair.random(),
            'Matrix ' + route.name + ' ' + principal.name + ' ' + Keypair.random().publicKey(),
          );
          expect(created.status, label).toBe(201);
          record = created.body.record as MatrixRecord;
        }
        const path = typeof route.path === 'function' ? route.path(record!.id) : route.path;
        const http = send(route.method, path);
        if (principal.session) http.set('Cookie', principal.session.cookie);
        if (route.write) {
          http.set('Origin', origin);
          http.send(principal.session ? route.body!(principal.session, record) : {});
        }
        const response = await http;
        if (!principal.session) {
          expect(response.status, label).toBe(401);
        } else if (!route.allowed.includes(principal.role!)) {
          expect(response.status, label).toBe(403);
        } else {
          expect([200, 201], label).toContain(response.status);
          if (route.name === 'POST /api/records') recordIds.add(response.body.record.id);
        }
      }
    }
  }, 120_000);

  describe('last active admin protection', () => {
    type AdminSession = Awaited<ReturnType<typeof login>>;

    async function seedAdmins(count: number): Promise<AdminSession[]> {
      const sessions: AdminSession[] = [];
      for (let index = 0; index < count; index += 1) {
        const wallet = Keypair.random();
        wallets.add(wallet.publicKey());
        await pool.query('INSERT INTO users (wallet_address) VALUES ($1) ON CONFLICT DO NOTHING', [
          wallet.publicKey(),
        ]);
        await pool.query(
          `INSERT INTO wallet_roles (wallet_address, role, updated_by) VALUES ($1, 'admin', $1)`,
          [wallet.publicKey()],
        );
        sessions.push(await login(wallet));
      }
      return sessions;
    }

    // Temporarily demotes every other admin in the test database so `sessions` are the only
    // admins, runs `body`, then restores the demoted admins.
    async function withOnlyAdmins(sessions: AdminSession[], body: () => Promise<void>) {
      const demoted = await pool.query<{ wallet_address: string }>(
        `UPDATE wallet_roles SET role = 'donor'
         WHERE role = 'admin' AND wallet_address <> ALL($1::text[])
         RETURNING wallet_address`,
        [sessions.map((session) => session.address)],
      );
      try {
        await body();
      } finally {
        await pool.query(`UPDATE wallet_roles SET role = 'admin' WHERE wallet_address = ANY($1)`, [
          demoted.rows.map((row) => row.wallet_address),
        ]);
      }
    }

    function removeRole(session: AdminSession, target: string) {
      return request(app)
        .delete('/api/admin/roles/' + encodeURIComponent(target))
        .set('Origin', origin)
        .set('Cookie', session.cookie)
        .send({ csrfToken: session.csrfToken });
    }

    function setRole(session: AdminSession, target: string, role: string) {
      return request(app)
        .post('/api/admin/roles')
        .set('Origin', origin)
        .set('Cookie', session.cookie)
        .send({ csrfToken: session.csrfToken, address: target, role });
    }

    async function roleOf(address: string) {
      const result = await pool.query<{ role: string }>(
        'SELECT role FROM wallet_roles WHERE wallet_address = $1',
        [address],
      );
      return result.rows[0]?.role;
    }

    async function adminCount(addresses: string[]) {
      const result = await pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM wallet_roles
         WHERE role = 'admin' AND wallet_address = ANY($1::text[])`,
        [addresses],
      );
      return Number(result.rows[0].count);
    }

    async function roleAuditCount(actors: string[]) {
      const result = await pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM audit_events
         WHERE action IN ('wallet_role_changed', 'wallet_role_removed')
           AND actor_wallet = ANY($1::text[])`,
        [actors],
      );
      return Number(result.rows[0].count);
    }

    // Polls until some backend is waiting on a lock held by `blockerPid`.
    async function waitUntilBlockedBy(blockerPid: number) {
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const result = await pool.query<{ waiting: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM pg_stat_activity WHERE $1::int = ANY(pg_blocking_pids(pid))
           ) AS waiting`,
          [blockerPid],
        );
        if (result.rows[0].waiting) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error('Role mutation never blocked on the admin row lock.');
    }

    const concurrentDemotions = {
      // Same upsert the POST handler uses, so the waiting FOR UPDATE re-checks an updated row.
      upsert: `INSERT INTO wallet_roles (wallet_address, role, updated_by)
               VALUES ($1, 'donor', $1)
               ON CONFLICT (wallet_address)
               DO UPDATE SET role = EXCLUDED.role, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      // Same statement the DELETE handler uses, so the waiting FOR UPDATE sees a deleted row.
      delete: 'DELETE FROM wallet_roles WHERE wallet_address = $1',
    } as const;

    it.each([
      { operation: 'remove', demotion: 'upsert' },
      { operation: 'remove', demotion: 'delete' },
      { operation: 'demote', demotion: 'upsert' },
      { operation: 'demote', demotion: 'delete' },
    ] as const)(
      'rejects $operation of the last admin by a caller demoted mid-request ($demotion) with 409',
      async ({ operation, demotion }) => {
        const [callerA, adminB] = await seedAdmins(2);
        await withOnlyAdmins([callerA, adminB], async () => {
          const raw = await pool.connect();
          let rawOpen = false;
          try {
            const { rows } = await raw.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
            await raw.query('BEGIN');
            rawOpen = true;
            // Demote A without committing: A's row stays locked and A still looks like an admin
            // to authorize(), which reads committed data.
            await raw.query(concurrentDemotions[demotion], [callerA.address]);

            const pending =
              operation === 'remove'
                ? removeRole(callerA, adminB.address).then((result) => result)
                : setRole(callerA, adminB.address, 'donor').then((result) => result);
            await waitUntilBlockedBy(rows[0].pid);
            await raw.query('COMMIT');
            rawOpen = false;

            const result = await pending;
            expect(result.status).toBe(409);
            expect(result.body.error).toBe('At least one active admin must remain.');
          } finally {
            if (rawOpen) await raw.query('ROLLBACK');
            raw.release();
          }
          expect(await roleOf(adminB.address)).toBe('admin');
          expect(await roleAuditCount([callerA.address])).toBe(0);
        });
      },
      60_000,
    );

    it('allows removing or demoting an admin while another admin remains', async () => {
      const [callerA, adminB, adminC] = await seedAdmins(3);
      await withOnlyAdmins([callerA, adminB, adminC], async () => {
        const removed = await removeRole(callerA, adminB.address);
        expect(removed.status).toBe(200);
        expect(await roleOf(adminB.address)).toBeUndefined();
        await expectAuditEvent('wallet_role_removed', callerA.address, {
          subjectWallet: adminB.address,
          metadata: { previousRole: 'admin', newRole: 'donor' },
        });

        const demoted = await setRole(callerA, adminC.address, 'organization');
        expect(demoted.status).toBe(200);
        expect(await roleOf(adminC.address)).toBe('organization');
        await expectAuditEvent('wallet_role_changed', callerA.address, {
          subjectWallet: adminC.address,
          metadata: { previousRole: 'admin', newRole: 'organization' },
        });

        expect(await adminCount([callerA.address, adminB.address, adminC.address])).toBe(1);
      });
    }, 60_000);

    it.each([
      { name: 'remove/remove', a: 'remove', b: 'remove' },
      { name: 'demote/demote', a: 'demote', b: 'demote' },
      { name: 'demote/remove', a: 'demote', b: 'remove' },
    ] as const)(
      'keeps one admin when the only two admins race ($name)',
      async ({ a, b }) => {
        const [adminA, adminB] = await seedAdmins(2);
        await withOnlyAdmins([adminA, adminB], async () => {
          const mutate = (
            operation: 'remove' | 'demote',
            caller: AdminSession,
            target: AdminSession,
          ) =>
            operation === 'remove'
              ? removeRole(caller, target.address)
              : setRole(caller, target.address, 'donor');
          const results = await Promise.all([mutate(a, adminA, adminB), mutate(b, adminB, adminA)]);
          const statuses = results.map((result) => result.status);
          expect(statuses.filter((status) => status === 200)).toHaveLength(1);
          const rejected = statuses.find((status) => status !== 200);
          expect([403, 409]).toContain(rejected);
          expect(await adminCount([adminA.address, adminB.address])).toBe(1);
          expect(await roleAuditCount([adminA.address, adminB.address])).toBe(1);
        });
      },
      60_000,
    );
  });
});
