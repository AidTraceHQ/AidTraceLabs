import { createHash, createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Keypair } from '@stellar/stellar-sdk';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { applyUniqueNetworkTxHashMigration, migrate } from '../scripts/migrate.js';
import { app } from '../server/app.js';
import { verifySep53Signature } from '../server/auth.js';
import { pool } from '../server/db.js';
import { checkTransaction } from '../server/stellar-verification.js';

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

    const preflight = await request(app)
      .options('/api/records')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(origin);
    expect(preflight.headers['access-control-allow-credentials']).toBe('true');
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
});

const integration = describe.skipIf(!process.env.TEST_DATABASE_URL);

integration('Database-backed wallet, records, and authorization flows', () => {
  const wallets = new Set<string>();
  const recordIds = new Set<string>();
  let admin: Keypair;

  afterEach(() => vi.unstubAllGlobals());

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
    if (addresses.length) {
      await pool.query(
        `DELETE FROM audit_events
         WHERE actor_wallet = ANY($1::text[]) OR subject_wallet = ANY($1::text[])
            OR record_id = ANY($2::text[])`,
        [addresses, ids],
      );
      if (ids.length) {
        await pool.query('DELETE FROM verification_results WHERE aid_record_id = ANY($1::text[])', [
          ids,
        ]);
        await pool.query('DELETE FROM aid_records WHERE id = ANY($1::text[])', [ids]);
      }
      await pool.query('DELETE FROM organizations WHERE wallet_address = ANY($1::text[])', [
        addresses,
      ]);
      await pool.query(
        `DELETE FROM wallet_roles
         WHERE wallet_address = ANY($1::text[]) OR updated_by = ANY($1::text[])`,
        [addresses],
      );
      await pool.query('DELETE FROM sessions WHERE wallet_address = ANY($1::text[])', [addresses]);
      await pool.query('DELETE FROM challenges WHERE wallet_address = ANY($1::text[])', [
        addresses,
      ]);
      await pool.query('DELETE FROM users WHERE wallet_address = ANY($1::text[])', [addresses]);
    }
    await pool.end();
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

  type RecordBody = Record<string, unknown> & { id: string; version: number };

  async function organizationSession() {
    const adminSession = await login(admin);
    const organization = Keypair.random();
    await assignRole(adminSession, organization, 'organization');
    return login(organization);
  }

  function editRecord(
    session: { cookie: string; csrfToken: string },
    record: RecordBody,
    changes: Record<string, unknown> = {},
  ) {
    return request(app)
      .put('/api/records/' + record.id)
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({
        csrfToken: session.csrfToken,
        recipient: record.recipient,
        recipientAddress: record.recipientAddress,
        purpose: record.purpose,
        amount: record.amount,
        asset: record.asset,
        assetIssuer: record.assetIssuer,
        network: record.network,
        txHash: record.txHash,
        date: record.date,
        note: record.note,
        recipientConsent: record.recipientConsent,
        ...changes,
      });
  }

  async function storedRecord(id: string) {
    const result = await pool.query<{ purpose: string; version: number }>(
      'SELECT purpose, version FROM aid_records WHERE id = $1',
      [id],
    );
    return result.rows[0];
  }

  async function updateAuditCount(id: string) {
    const result = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM audit_events
       WHERE action = 'record_updated' AND record_id = $1`,
      [id],
    );
    return result.rows[0]?.total;
  }

  it('adds a NOT NULL integer version column through an idempotent migration', async () => {
    const column = await pool.query<{ data_type: string; is_nullable: string }>(
      `SELECT data_type, is_nullable FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'aid_records'
         AND column_name = 'version'`,
    );
    expect(column.rows).toEqual([{ data_type: 'integer', is_nullable: 'NO' }]);
    const applied = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE version = '004_record_version'",
    );
    expect(applied.rowCount).toBe(1);

    const sql = await readFile(
      new URL('../migrations/004_record_version.sql', import.meta.url),
      'utf8',
    );
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(sql);
      const constraint = await client.query(
        `SELECT 1 FROM pg_constraint
         WHERE conrelid = 'aid_records'::regclass AND conname = 'aid_records_version_positive'`,
      );
      expect(constraint.rowCount).toBe(1);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('accepts exactly one of two edits carrying the same expectedVersion', async () => {
    const session = await organizationSession();
    const recipient = Keypair.random();

    const sequential = await createRecord(session, recipient, 'Version sequential original');
    expect(sequential.status).toBe(201);
    expect(sequential.body.record.version).toBe(1);
    const first = await editRecord(session, sequential.body.record, {
      purpose: 'Version sequential first edit',
      expectedVersion: 1,
    });
    const second = await editRecord(session, sequential.body.record, {
      purpose: 'Version sequential second edit',
      expectedVersion: 1,
    });
    expect(first.status).toBe(200);
    expect(first.body.record.version).toBe(2);
    expect(second.status).toBe(409);
    expect(second.body).toEqual({ error: 'Record changed concurrently. Refresh before editing.' });
    expect(await storedRecord(sequential.body.record.id)).toEqual({
      purpose: 'Version sequential first edit',
      version: 2,
    });
    expect(await updateAuditCount(sequential.body.record.id)).toBe(1);

    const parallel = await createRecord(session, recipient, 'Version parallel original');
    expect(parallel.status).toBe(201);
    const purposes = ['Version parallel edit A', 'Version parallel edit B'];
    const results = await Promise.all(
      purposes.map((purpose) =>
        editRecord(session, parallel.body.record, { purpose, expectedVersion: 1 }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const winner = purposes[results.findIndex((result) => result.status === 200)];
    expect(await storedRecord(parallel.body.record.id)).toEqual({ purpose: winner, version: 2 });
    expect(await updateAuditCount(parallel.body.record.id)).toBe(1);
  }, 120_000);

  it('rejects a stale edit even when both edits share the same updated_at millisecond', async () => {
    const session = await organizationSession();
    const created = await createRecord(session, Keypair.random(), 'Version same millisecond');
    expect(created.status).toBe(201);
    const pinnedUpdatedAt = '2026-01-15T00:00:00.000Z';
    const pinUpdatedAt = () =>
      pool.query('UPDATE aid_records SET updated_at = $2 WHERE id = $1', [
        created.body.record.id,
        pinnedUpdatedAt,
      ]);

    await pinUpdatedAt();
    const first = await editRecord(session, created.body.record, {
      purpose: 'Same millisecond first edit',
      expectedVersion: 1,
    });
    expect(first.status).toBe(200);
    // Simulate the second edit landing in the same millisecond as the first.
    await pinUpdatedAt();
    const second = await editRecord(session, created.body.record, {
      purpose: 'Same millisecond second edit',
      expectedVersion: 1,
    });
    expect(second.status).toBe(409);
    expect(await storedRecord(created.body.record.id)).toEqual({
      purpose: 'Same millisecond first edit',
      version: 2,
    });
  }, 120_000);

  it('increments version on edits and voids, not on verification, and returns it everywhere', async () => {
    const session = await organizationSession();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404 })),
    );
    const purpose = 'Version increment ' + Keypair.random().publicKey().slice(-8);
    const created = await createRecord(session, Keypair.random(), purpose, {
      txHash: createHash('sha256').update(purpose).digest('hex'),
    });
    expect(created.status).toBe(201);
    expect(created.body.record.version).toBe(1);

    const firstEdit = await editRecord(session, created.body.record, {
      note: 'First versioned edit',
      expectedVersion: 1,
    });
    expect(firstEdit.status).toBe(200);
    expect(firstEdit.body.record.version).toBe(2);

    // Omitting expectedVersion keeps the previous client behavior: the edit succeeds.
    const unversionedEdit = await editRecord(session, firstEdit.body.record, {
      note: 'Edit without expectedVersion',
    });
    expect(unversionedEdit.status).toBe(200);
    expect(unversionedEdit.body.record.version).toBe(3);
    expect(unversionedEdit.body.record.note).toBe('Edit without expectedVersion');

    const verified = await request(app)
      .post('/api/records/' + created.body.record.id + '/verify')
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({ csrfToken: session.csrfToken });
    expect(verified.status).toBe(200);
    expect(verified.body.record.status).toBe('not-found');
    expect(verified.body.record.version).toBe(3);
    expect((await storedRecord(created.body.record.id))?.version).toBe(3);

    const single = await request(app)
      .get('/api/records/' + created.body.record.id)
      .set('Cookie', session.cookie);
    expect(single.status).toBe(200);
    expect(single.body.record.version).toBe(3);
    const ownerList = await request(app)
      .get('/api/transparency')
      .query({ q: purpose })
      .set('Cookie', session.cookie);
    expect(ownerList.status).toBe(200);
    expect(ownerList.body.records).toHaveLength(1);
    expect(ownerList.body.records[0].version).toBe(3);
    const publicList = await request(app).get('/api/transparency').query({ q: purpose });
    expect(publicList.body.records[0].recipientAddress).toBe('');
    expect(publicList.body.records[0].version).toBe(3);

    const voided = await request(app)
      .post('/api/records/' + created.body.record.id + '/void')
      .set('Origin', origin)
      .set('Cookie', session.cookie)
      .send({ csrfToken: session.csrfToken, reason: 'Version bump check' });
    expect(voided.status).toBe(200);
    expect(voided.body.record.version).toBe(4);
    expect((await storedRecord(created.body.record.id))?.version).toBe(4);
  }, 120_000);

  it('rejects malformed expectedVersion values and leaves the record unchanged', async () => {
    const session = await organizationSession();
    const created = await createRecord(session, Keypair.random(), 'Version validation original');
    expect(created.status).toBe(201);
    for (const expectedVersion of ['abc', 1.5, 0, -1, true, null, '1']) {
      const rejected = await editRecord(session, created.body.record, {
        purpose: 'Version validation should not apply',
        expectedVersion,
      });
      expect(rejected.status, JSON.stringify(expectedVersion)).toBe(400);
      expect(rejected.body).toEqual({ error: 'expectedVersion must be a positive integer.' });
      expect(await storedRecord(created.body.record.id)).toEqual({
        purpose: 'Version validation original',
        version: 1,
      });
    }
    expect(await updateAuditCount(created.body.record.id)).toBe(0);
  }, 120_000);
});
