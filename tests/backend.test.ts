import { createHash, createHmac, randomBytes } from 'node:crypto';
import { createServer, type Socket } from 'node:net';
import { Keypair } from '@stellar/stellar-sdk';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyUniqueNetworkTxHashMigration, migrate } from '../scripts/migrate.js';
import { app } from '../server/app.js';
import { verifySep53Signature } from '../server/auth.js';
import { pool, withTransaction } from '../server/db.js';
import { parseNotificationConfig } from '../server/notification-config.js';
import {
  classifyStatus,
  createMemoryReplayStore,
  decryptField,
  DELIVERY_HEADER,
  DeliveryError,
  encryptField,
  httpsTransport,
  isPublicAddress,
  parseWebhookUrl,
  retryDelayMs,
  sendSignedWebhook,
  SIGNATURE_HEADER,
  signWebhook,
  verifyWebhookSignature,
  type Resolver,
  type Transport,
  type TransportRequest,
  type TransportResponse,
} from '../server/notification-security.js';
import {
  buildRecordEventPayload,
  enqueueRecordEvent,
  enqueueStatusChange,
  lockRecordStatus,
  processDueDeliveries,
  resetNotificationDependencies,
  setNotificationDependencies,
} from '../server/notifications.js';
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
});

const notificationEnvironmentKeys = [
  'NOTIFICATIONS_ENABLED',
  'NOTIFICATIONS_ENCRYPTION_KEY',
  'NOTIFICATIONS_MAX_ATTEMPTS',
  'NOTIFICATIONS_CONNECT_TIMEOUT_MS',
  'NOTIFICATIONS_READ_TIMEOUT_MS',
  'NOTIFICATIONS_RETRY_BASE_MS',
] as const;

function clearNotificationEnvironment() {
  for (const key of notificationEnvironmentKeys) delete process.env[key];
}

const publicResolver: Resolver = async () => [{ address: '93.184.215.14', family: 4 }];

describe('Webhook notifications: signing, SSRF guard, redaction and disabled delivery', () => {
  const secret = 'whsec_unit-test-signing-secret-value';
  afterEach(() => {
    clearNotificationEnvironment();
    resetNotificationDependencies();
  });

  it('signs deliveries and rejects tampering, wrong keys, stale timestamps and replays', () => {
    const now = Date.UTC(2026, 10, 20, 12, 0, 0);
    const timestamp = Math.floor(now / 1000);
    const body = JSON.stringify({ id: 'evt_1', type: 'record.created' });
    const deliveryId = 'dlv_' + 'a'.repeat(32);
    const header = signWebhook(secret, deliveryId, timestamp, body);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    const store = createMemoryReplayStore(() => now);
    const check = (overrides: Partial<Parameters<typeof verifyWebhookSignature>[0]> = {}) =>
      verifyWebhookSignature({
        secret,
        signatureHeader: header,
        deliveryId,
        body,
        replayStore: store,
        nowMs: now,
        ...overrides,
      });

    expect(check({ body: body.replace('created', 'voided') })).toEqual({
      ok: false,
      reason: 'mismatch',
    });
    expect(check({ secret: 'whsec_another-secret' })).toEqual({ ok: false, reason: 'mismatch' });
    expect(check({ deliveryId: 'dlv_' + 'b'.repeat(32) })).toEqual({
      ok: false,
      reason: 'mismatch',
    });
    expect(check({ nowMs: now + 301_000 })).toEqual({ ok: false, reason: 'stale' });
    expect(check({ signatureHeader: 'v1=deadbeef' })).toEqual({ ok: false, reason: 'malformed' });
    expect(check({ signatureHeader: undefined })).toEqual({ ok: false, reason: 'malformed' });
    // Failed checks must not consume the delivery id.
    expect(check()).toEqual({ ok: true });
    expect(check()).toEqual({ ok: false, reason: 'replayed' });
    expect(check({ nowMs: now + 60_000 })).toEqual({ ok: false, reason: 'replayed' });
  });

  it('rejects loopback, private, link-local, unique-local and cloud-metadata addresses', () => {
    for (const address of [
      '127.0.0.1',
      '127.255.0.9',
      '10.0.0.1',
      '172.16.4.2',
      '192.168.1.10',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
      '::',
      '::1',
      'fe80::1',
      'fc00::1',
      'fd00:ec2::254',
      '::ffff:127.0.0.1',
      '::ffff:a9fe:a9fe',
      '64:ff9b::a9fe:a9fe',
      '2002:7f00:1::1',
      'ff02::1',
      'not-an-ip',
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
    for (const address of ['93.184.215.14', '8.8.8.8', '2606:4700:4700::1111']) {
      expect(isPublicAddress(address), address).toBe(true);
    }
  });

  it('accepts only HTTPS webhook URLs without embedded credentials', () => {
    expect(parseWebhookUrl('https://hooks.example.test/aidtrace?x=1#fragment')?.toString()).toBe(
      'https://hooks.example.test/aidtrace?x=1',
    );
    for (const value of [
      'http://hooks.example.test/aidtrace',
      'https://user:pass@hooks.example.test/',
      'ftp://hooks.example.test/',
      'not a url',
      'https://' + 'a'.repeat(2100) + '.test/',
      42,
    ]) {
      expect(parseWebhookUrl(value), String(value)).toBeNull();
    }
  });

  it('blocks private targets before sending and re-checks every redirect hop', async () => {
    const base = {
      secret,
      deliveryId: 'dlv_' + 'c'.repeat(32),
      eventType: 'record.created',
      body: '{}',
      connectTimeoutMs: 1234,
      readTimeoutMs: 5678,
    };
    const resolver: Resolver = async (host) =>
      host.endsWith('.internal.test')
        ? [{ address: '10.0.0.7', family: 4 }]
        : host === 'mixed.example.test'
          ? [
              { address: '93.184.215.14', family: 4 },
              { address: '127.0.0.1', family: 4 },
            ]
          : [{ address: '93.184.215.14', family: 4 }];

    for (const target of [
      'https://hooks.internal.test/x',
      'https://mixed.example.test/x',
      'https://127.0.0.1/x',
      'https://[::1]/x',
      'https://169.254.169.254/latest/meta-data',
    ]) {
      const transport = vi.fn<Transport>(async () => ({ status: 200, body: '' }));
      await expect(
        sendSignedWebhook({ ...base, url: new URL(target), transport, resolver }),
      ).rejects.toMatchObject({ code: 'blocked_address', retryable: false });
      expect(transport, target).not.toHaveBeenCalled();
    }

    for (const location of [
      'https://hooks.internal.test/next',
      'https://169.254.169.254/latest/meta-data',
      'https://[fd00:ec2::254]/',
    ]) {
      const transport = vi.fn<Transport>(async () => ({ status: 307, location, body: '' }));
      await expect(
        sendSignedWebhook({
          ...base,
          url: new URL('https://hooks.example.test/a'),
          transport,
          resolver,
        }),
      ).rejects.toMatchObject({ code: 'blocked_address' });
      expect(transport, location).toHaveBeenCalledTimes(1);
    }

    const insecureRedirect = vi.fn<Transport>(async () => ({
      status: 308,
      location: 'http://hooks.example.test/plain',
      body: '',
    }));
    await expect(
      sendSignedWebhook({
        ...base,
        url: new URL('https://hooks.example.test/a'),
        transport: insecureRedirect,
        resolver,
      }),
    ).rejects.toMatchObject({ code: 'redirect_rejected', retryable: false });

    const loop = vi.fn<Transport>(async () => ({ status: 307, location: '/again', body: '' }));
    await expect(
      sendSignedWebhook({
        ...base,
        url: new URL('https://hooks.example.test/a'),
        transport: loop,
        resolver,
      }),
    ).rejects.toMatchObject({ code: 'redirect_limit' });
    expect(loop).toHaveBeenCalledTimes(4);

    const ok = vi.fn<Transport>(async () => ({ status: 204, body: '' }));
    await sendSignedWebhook({
      ...base,
      url: new URL('https://hooks.example.test/a'),
      transport: ok,
      resolver,
    });
    const sent = ok.mock.calls[0]![0];
    expect(sent.address).toEqual({ address: '93.184.215.14', family: 4 });
    expect(sent.connectTimeoutMs).toBe(1234);
    expect(sent.readTimeoutMs).toBe(5678);
    expect(sent.headers[DELIVERY_HEADER]).toBe(base.deliveryId);
    expect(sent.headers[SIGNATURE_HEADER]).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it('enforces an explicit connect timeout on the HTTPS transport', async () => {
    // A local TCP listener that never answers the TLS handshake; nothing leaves the machine.
    const sockets = new Set<Socket>();
    const server = createServer((socket) => sockets.add(socket));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    try {
      const started = Date.now();
      await expect(
        httpsTransport({
          url: new URL(`https://hooks.example.test:${port}/`),
          address: { address: '127.0.0.1', family: 4 },
          headers: {},
          body: '{}',
          connectTimeoutMs: 150,
          readTimeoutMs: 150,
        }),
      ).rejects.toMatchObject({ code: 'connect_timeout', retryable: true });
      expect(Date.now() - started).toBeLessThan(5_000);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('bounds the retry backoff and classifies retryable responses', () => {
    for (let attempt = 1; attempt <= 30; attempt += 1) {
      const delay = retryDelayMs(attempt, 30_000, 3_600_000);
      expect(delay).toBeGreaterThanOrEqual(15_000);
      expect(delay).toBeLessThanOrEqual(3_600_000);
    }
    expect(retryDelayMs(1, 30_000, 3_600_000, () => 1)).toBe(30_000);
    expect(retryDelayMs(2, 30_000, 3_600_000, () => 1)).toBe(60_000);
    expect(retryDelayMs(30, 30_000, 3_600_000, () => 1)).toBe(3_600_000);
    expect(classifyStatus(200)).toBe('delivered');
    expect(classifyStatus(204)).toBe('delivered');
    for (const status of [408, 425, 429, 500, 503]) expect(classifyStatus(status)).toBe('retry');
    for (const status of [301, 400, 401, 403, 404, 410])
      expect(classifyStatus(status)).toBe('fail');
  });

  it('minimizes event payloads to identifiers and status', () => {
    const recipientWallet = Keypair.random().publicKey();
    const organizationWallet = Keypair.random().publicKey();
    const payload = buildRecordEventPayload({
      eventId: 'evt_test',
      type: 'record.verification_changed',
      previousStatus: 'pending',
      occurredAt: new Date('2026-11-20T00:00:00Z'),
      record: {
        id: 'record-1',
        network: 'testnet',
        status: 'verified',
        version: 3,
        recipient_name: 'Amina Example',
        recipient_wallet: recipientWallet,
        organization_wallet: organizationWallet,
        note: 'Private contact note',
        purpose: 'Medical support',
        tx_hash: 'f'.repeat(64),
        amount_stroops: '12500000',
      },
    });
    expect(payload).toEqual({
      id: 'evt_test',
      type: 'record.verification_changed',
      createdAt: '2026-11-20T00:00:00.000Z',
      data: {
        recordId: 'record-1',
        network: 'testnet',
        status: 'verified',
        previousStatus: 'pending',
        version: 3,
      },
    });
    const serialized = JSON.stringify(payload);
    for (const value of [
      'Amina Example',
      recipientWallet,
      organizationWallet,
      'Private contact note',
      'Medical support',
      'f'.repeat(64),
      '12500000',
    ]) {
      expect(serialized).not.toContain(value);
    }
  });

  it('encrypts stored secrets and binds each ciphertext to its row and field', () => {
    const key = randomBytes(32);
    const sealed = encryptField(key, secret, 'endpoint-1:secret');
    expect(sealed).not.toContain(secret);
    expect(decryptField(key, sealed, 'endpoint-1:secret')).toBe(secret);
    expect(() => decryptField(key, sealed, 'endpoint-2:secret')).toThrow();
    expect(() => decryptField(randomBytes(32), sealed, 'endpoint-1:secret')).toThrow();
  });

  it('validates notification configuration only when delivery is enabled', () => {
    const base = {
      SESSION_SECRET: 'session-secret-value-with-at-least-32-bytes',
      PSEUDONYM_SECRET: 'pseudonym-secret-value-with-at-least-32-bytes',
    };
    expect(parseNotificationConfig({ ...base })).toEqual({ enabled: false });
    expect(parseNotificationConfig({ ...base, NOTIFICATIONS_ENABLED: 'false' })).toEqual({
      enabled: false,
    });
    expect(() => parseNotificationConfig({ ...base, NOTIFICATIONS_ENABLED: 'yes' })).toThrow(
      'NOTIFICATIONS_ENABLED',
    );
    expect(() => parseNotificationConfig({ ...base, NOTIFICATIONS_ENABLED: 'true' })).toThrow(
      'NOTIFICATIONS_ENCRYPTION_KEY',
    );
    expect(() =>
      parseNotificationConfig({
        ...base,
        NOTIFICATIONS_ENABLED: 'true',
        NOTIFICATIONS_ENCRYPTION_KEY: base.SESSION_SECRET,
      }),
    ).toThrow('must differ');
    const key = 'notification-key-value-with-at-least-32-bytes';
    expect(() =>
      parseNotificationConfig({
        ...base,
        NOTIFICATIONS_ENABLED: 'true',
        NOTIFICATIONS_ENCRYPTION_KEY: key,
        NOTIFICATIONS_MAX_ATTEMPTS: '11',
      }),
    ).toThrow('NOTIFICATIONS_MAX_ATTEMPTS');
    expect(
      parseNotificationConfig({
        ...base,
        NOTIFICATIONS_ENABLED: 'true',
        NOTIFICATIONS_ENCRYPTION_KEY: key,
      }),
    ).toMatchObject({
      enabled: true,
      maxAttempts: 5,
      connectTimeoutMs: 5_000,
      readTimeoutMs: 10_000,
    });
  });

  it('keeps the API unchanged and runs no notification queries when delivery is disabled', async () => {
    clearNotificationEnvironment();
    const transport = vi.fn<Transport>(async () => ({ status: 200, body: '' }));
    setNotificationDependencies({ transport, resolver: publicResolver });

    for (const call of [
      request(app).get('/api/notifications/endpoints'),
      request(app)
        .post('/api/notifications/endpoints')
        .set('Origin', origin)
        .send({ url: 'https://hooks.example.test/' }),
      request(app).post('/api/notifications/deliveries/dlv_x/cancel').set('Origin', origin),
    ]) {
      const response = await call;
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Route not found.' });
    }

    const client = { query: vi.fn() };
    expect(await lockRecordStatus(client as never, 'record-1')).toBeNull();
    await enqueueRecordEvent(client as never, 'record.created', 'record-1');
    await enqueueStatusChange(client as never, 'record-1', 'pending');
    expect(client.query).not.toHaveBeenCalled();
    expect(await processDueDeliveries()).toEqual({
      claimed: 0,
      delivered: 0,
      retried: 0,
      failed: 0,
      cancelled: 0,
    });
    expect(transport).not.toHaveBeenCalled();
  });
});

const integration = describe.skipIf(!process.env.TEST_DATABASE_URL);

integration('Database-backed wallet, records, and authorization flows', () => {
  const wallets = new Set<string>();
  const recordIds = new Set<string>();
  let admin: Keypair;

  afterEach(() => vi.unstubAllGlobals());

  async function expectAuditEvent(
    action: string,
    actorWallet: string,
    expected: { subjectWallet?: string; recordId?: string } = {},
  ) {
    const subjectWallet = expected.subjectWallet ?? null;
    const recordId = expected.recordId ?? null;
    const result = await pool.query<{
      action: string;
      actor_wallet: string;
      subject_wallet: string | null;
      record_id: string | null;
    }>(
      `SELECT action, actor_wallet, subject_wallet, record_id
       FROM audit_events
       WHERE action = $1 AND actor_wallet = $2
         AND subject_wallet IS NOT DISTINCT FROM $3
         AND record_id IS NOT DISTINCT FROM $4
       ORDER BY created_at DESC
       LIMIT 1`,
      [action, actorWallet, subjectWallet, recordId],
    );
    expect(result.rows[0], `Missing ${action} audit event for ${actorWallet}`).toEqual({
      action,
      actor_wallet: actorWallet,
      subject_wallet: subjectWallet,
      record_id: recordId,
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
        });

        const demoted = await setRole(callerA, adminC.address, 'organization');
        expect(demoted.status).toBe(200);
        expect(await roleOf(adminC.address)).toBe('organization');
        await expectAuditEvent('wallet_role_changed', callerA.address, {
          subjectWallet: adminC.address,
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
  describe('webhook notifications', () => {
    type TestSession = Awaited<ReturnType<typeof login>>;
    const sent: TransportRequest[] = [];
    let respond: (outgoing: TransportRequest) => TransportResponse | Promise<TransportResponse>;
    const echoChallenge = (outgoing: TransportRequest): TransportResponse => {
      const parsed = JSON.parse(outgoing.body) as { type: string; data: { challenge?: string } };
      return parsed.type === 'endpoint.verification'
        ? { status: 200, body: parsed.data.challenge || '' }
        : { status: 204, body: '' };
    };
    const testOwners = new Set<string>();

    beforeAll(() => {
      process.env.NOTIFICATIONS_ENABLED = 'true';
      process.env.NOTIFICATIONS_ENCRYPTION_KEY = 'vitest-notification-encryption-key-32-bytes';
      process.env.NOTIFICATIONS_MAX_ATTEMPTS = '3';
      setNotificationDependencies({
        resolver: async (host) =>
          host.endsWith('.internal.test')
            ? [{ address: '10.0.0.8', family: 4 }]
            : [{ address: '93.184.215.14', family: 4 }],
        transport: async (outgoing) => {
          sent.push(outgoing);
          return respond(outgoing);
        },
      });
    });

    beforeEach(() => {
      sent.length = 0;
      respond = echoChallenge;
    });

    afterEach(async () => {
      vi.restoreAllMocks();
      // Leave no due work behind for the next test's worker run.
      await pool.query(
        `UPDATE notification_deliveries SET status = 'cancelled'
         WHERE status IN ('pending', 'delivering')
           AND endpoint_id IN (
             SELECT id FROM notification_endpoints WHERE owner_wallet = ANY($1::text[]))`,
        [[...testOwners]],
      );
    });

    afterAll(async () => {
      await pool.query('DELETE FROM notification_endpoints WHERE owner_wallet = ANY($1::text[])', [
        [...testOwners],
      ]);
      clearNotificationEnvironment();
      resetNotificationDependencies();
    });

    const uniqueHost = () => `hooks-${randomBytes(4).toString('hex')}.example.test`;
    const sentTo = (host: string) => sent.filter((outgoing) => outgoing.url.hostname === host);

    // The challenge endpoint allows eight challenges per wallet per 15 minutes, so reuse one.
    let cachedAdminSession: TestSession | undefined;
    async function adminSessionOnce() {
      cachedAdminSession ??= await login(admin);
      return cachedAdminSession;
    }

    async function organizationSession() {
      const adminSession = await adminSessionOnce();
      const wallet = Keypair.random();
      await assignRole(adminSession, wallet, 'organization');
      const session = await login(wallet);
      testOwners.add(session.address);
      return session;
    }

    function registerEndpoint(session: TestSession, body: Record<string, unknown>) {
      return request(app)
        .post('/api/notifications/endpoints')
        .set('Origin', origin)
        .set('Cookie', session.cookie)
        .send({ csrfToken: session.csrfToken, ...body });
    }

    function endpointAction(session: TestSession, method: 'post' | 'delete', path: string) {
      return request(app)
        [method](path)
        .set('Origin', origin)
        .set('Cookie', session.cookie)
        .send({ csrfToken: session.csrfToken });
    }

    async function activeEndpoint(session: TestSession, body: Record<string, unknown> = {}) {
      const host = uniqueHost();
      const created = await registerEndpoint(session, { url: `https://${host}/aidtrace`, ...body });
      expect(created.status).toBe(201);
      const verified = await endpointAction(
        session,
        'post',
        `/api/notifications/endpoints/${created.body.endpoint.id}/verify`,
      );
      expect(verified.status).toBe(200);
      expect(verified.body.endpoint.status).toBe('active');
      sent.length = 0;
      return {
        id: created.body.endpoint.id as string,
        host,
        secret: created.body.signingSecret as string,
      };
    }

    async function deliveriesFor(endpointId: string) {
      const result = await pool.query<{
        id: string;
        event_type: string;
        status: string;
        attempts: number;
        last_error: string | null;
        next_attempt_at: Date;
      }>(
        `SELECT id, event_type, status, attempts, last_error, next_attempt_at
         FROM notification_deliveries WHERE endpoint_id = $1 ORDER BY created_at, id`,
        [endpointId],
      );
      return result.rows;
    }

    it('authorizes endpoint management and verifies recipients before any delivery', async () => {
      const owner = await organizationSession();
      const other = await organizationSession();
      const donorWallet = Keypair.random();
      const donor = await login(donorWallet);

      expect((await registerEndpoint(donor, { url: 'https://hooks.example.test/' })).status).toBe(
        403,
      );
      const noCsrf = await request(app)
        .post('/api/notifications/endpoints')
        .set('Origin', origin)
        .set('Cookie', owner.cookie)
        .send({ url: 'https://hooks.example.test/' });
      expect(noCsrf.status).toBe(403);
      for (const url of [
        'http://hooks.example.test/',
        'https://user:pass@hooks.example.test/',
        'https://hooks.internal.test/',
        'https://169.254.169.254/latest/meta-data',
      ]) {
        expect((await registerEndpoint(owner, { url })).status, url).toBe(400);
      }
      expect(
        (await registerEndpoint(owner, { url: 'https://hooks.example.test/', scope: 'all' }))
          .status,
      ).toBe(400);
      expect(
        (await registerEndpoint(owner, { url: 'https://hooks.example.test/', events: ['nope'] }))
          .status,
      ).toBe(400);
      expect(sent).toHaveLength(0);

      const host = uniqueHost();
      const urlToken = 'url-path-credential-' + randomBytes(6).toString('hex');
      const created = await registerEndpoint(owner, {
        url: `https://${host}/aidtrace?token=${urlToken}`,
      });
      expect(created.status).toBe(201);
      const endpointId = created.body.endpoint.id as string;
      const signingSecret = created.body.signingSecret as string;
      expect(signingSecret).toMatch(/^whsec_[A-Za-z0-9_-]{43}$/);
      expect(created.body.endpoint).toMatchObject({
        host,
        scope: 'organization',
        status: 'pending_verification',
      });
      expect(JSON.stringify(created.body)).not.toContain(urlToken);

      const stored = await pool.query<{ url_ciphertext: string; secret_ciphertext: string }>(
        'SELECT url_ciphertext, secret_ciphertext FROM notification_endpoints WHERE id = $1',
        [endpointId],
      );
      expect(JSON.stringify(stored.rows[0])).not.toContain(urlToken);
      expect(JSON.stringify(stored.rows[0])).not.toContain(signingSecret);

      // Unverified endpoints receive nothing.
      const beforeVerification = await createRecord(owner, Keypair.random(), 'Pre-verify record');
      expect(beforeVerification.status).toBe(201);
      expect(await deliveriesFor(endpointId)).toHaveLength(0);

      for (const [method, path] of [
        ['post', `/api/notifications/endpoints/${endpointId}/verify`],
        ['post', `/api/notifications/endpoints/${endpointId}/rotate-secret`],
        ['delete', `/api/notifications/endpoints/${endpointId}`],
      ] as const) {
        expect((await endpointAction(other, method, path)).status, path).toBe(404);
      }
      const foreignDeliveries = await request(app)
        .get('/api/notifications/deliveries')
        .query({ endpointId })
        .set('Cookie', other.cookie);
      expect(foreignDeliveries.status).toBe(404);

      respond = () => ({ status: 200, body: 'wrong-challenge' });
      const mismatch = await endpointAction(
        owner,
        'post',
        `/api/notifications/endpoints/${endpointId}/verify`,
      );
      expect(mismatch.status).toBe(422);
      expect(mismatch.body.error).toContain('challenge_mismatch');

      respond = echoChallenge;
      sent.length = 0;
      const verified = await endpointAction(
        owner,
        'post',
        `/api/notifications/endpoints/${endpointId}/verify`,
      );
      expect(verified.status).toBe(200);
      expect(verified.body.endpoint.status).toBe('active');
      expect(sent).toHaveLength(1);
      expect(sent[0]!.url.searchParams.get('token')).toBe(urlToken);
      expect(
        verifyWebhookSignature({
          secret: signingSecret,
          signatureHeader: sent[0]!.headers[SIGNATURE_HEADER],
          deliveryId: sent[0]!.headers[DELIVERY_HEADER],
          body: sent[0]!.body,
          replayStore: createMemoryReplayStore(),
        }),
      ).toEqual({ ok: true });

      const list = await request(app)
        .get('/api/notifications/endpoints')
        .set('Cookie', owner.cookie);
      expect(list.status).toBe(200);
      expect(list.body.endpoints).toHaveLength(1);
      expect(JSON.stringify(list.body)).not.toContain(urlToken);
      expect(JSON.stringify(list.body)).not.toContain(signingSecret);

      const rotated = await endpointAction(
        owner,
        'post',
        `/api/notifications/endpoints/${endpointId}/rotate-secret`,
      );
      expect(rotated.status).toBe(200);
      expect(rotated.body.signingSecret).toMatch(/^whsec_/);
      expect(rotated.body.signingSecret).not.toBe(signingSecret);

      const audits = await pool.query<{ summary: string; metadata_json: unknown }>(
        `SELECT summary, metadata_json FROM audit_events
         WHERE actor_wallet = $1 AND action LIKE 'notification_%'`,
        [owner.address],
      );
      expect(audits.rows.length).toBeGreaterThanOrEqual(3);
      const auditText = JSON.stringify(audits.rows);
      for (const value of [urlToken, signingSecret, rotated.body.signingSecret]) {
        expect(auditText).not.toContain(value);
      }
    }, 120_000);

    it('delivers signed, minimized events once and lets receivers reject replays', async () => {
      const owner = await organizationSession();
      const other = await organizationSession();
      const endpoint = await activeEndpoint(owner);
      const adminSession = await adminSessionOnce();
      testOwners.add(adminSession.address);
      const adminEndpoint = await activeEndpoint(adminSession, { scope: 'all' });
      const logged: string[] = [];
      for (const method of ['log', 'info', 'warn', 'error'] as const) {
        vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
          logged.push(args.map(String).join(' '));
        });
      }

      const beneficiary = Keypair.random();
      const created = await createRecord(owner, beneficiary, 'Confidential purpose text');
      expect(created.status).toBe(201);
      const recordId = created.body.record.id as string;
      const foreign = await createRecord(other, Keypair.random(), 'Other organization record');
      expect(foreign.status).toBe(201);

      expect((await deliveriesFor(endpoint.id)).map((row) => row.event_type)).toEqual([
        'record.created',
      ]);
      const adminEvents = (await deliveriesFor(adminEndpoint.id)).map((row) => row.event_type);
      expect(adminEvents.filter((type) => type === 'record.created')).toHaveLength(2);

      const summary = await processDueDeliveries();
      expect(summary.delivered).toBeGreaterThanOrEqual(3);
      const toOwner = sentTo(endpoint.host);
      expect(toOwner).toHaveLength(1);
      const delivery = toOwner[0]!;
      expect(delivery.address).toEqual({ address: '93.184.215.14', family: 4 });
      expect(delivery.connectTimeoutMs).toBe(5_000);
      expect(delivery.readTimeoutMs).toBe(10_000);
      expect(JSON.parse(delivery.body)).toMatchObject({
        type: 'record.created',
        data: { recordId, network: 'testnet', status: 'unverified', version: 1 },
      });
      for (const value of [
        'Confidential beneficiary',
        beneficiary.publicKey(),
        owner.address,
        'Private contact note',
        'Confidential purpose text',
      ]) {
        expect(delivery.body).not.toContain(value);
      }

      const receiverStore = createMemoryReplayStore();
      const receive = (outgoing: TransportRequest, body = outgoing.body) =>
        verifyWebhookSignature({
          secret: endpoint.secret,
          signatureHeader: outgoing.headers[SIGNATURE_HEADER],
          deliveryId: outgoing.headers[DELIVERY_HEADER],
          body,
          replayStore: receiverStore,
        });
      expect(receive(delivery, delivery.body.replace('unverified', 'verified'))).toEqual({
        ok: false,
        reason: 'mismatch',
      });
      expect(receive(delivery)).toEqual({ ok: true });
      expect(receive(delivery)).toEqual({ ok: false, reason: 'replayed' });

      expect((await deliveriesFor(endpoint.id))[0]).toMatchObject({
        status: 'delivered',
        attempts: 1,
      });
      sent.length = 0;
      await processDueDeliveries();
      expect(sentTo(endpoint.host)).toHaveLength(0);

      const voided = await request(app)
        .post(`/api/records/${recordId}/void`)
        .set('Origin', origin)
        .set('Cookie', owner.cookie)
        .send({ csrfToken: owner.csrfToken, reason: 'Duplicate entry for testing' });
      expect(voided.status).toBe(200);
      await processDueDeliveries();
      const voidEvents = sentTo(endpoint.host).map((outgoing) => JSON.parse(outgoing.body));
      expect(voidEvents).toMatchObject([{ type: 'record.voided', data: { recordId } }]);
      expect(JSON.stringify(voidEvents)).not.toContain('Duplicate entry for testing');

      const logText = logged.join('\n');
      for (const value of [endpoint.secret, adminEndpoint.secret, endpoint.host, delivery.body]) {
        expect(logText).not.toContain(value);
      }
    }, 120_000);

    it('emits a verification change only when the status flips', async () => {
      const owner = await organizationSession();
      const endpoint = await activeEndpoint(owner);
      const created = await createRecord(owner, Keypair.random(), 'Status flip record');
      expect(created.status).toBe(201);
      const recordId = created.body.record.id as string;
      // Simulate a verifier result through the same write path the API and scheduler use.
      await withTransaction(async (client) => {
        const previous = await lockRecordStatus(client, recordId);
        await client.query(`UPDATE aid_records SET status = 'verified' WHERE id = $1`, [recordId]);
        await enqueueStatusChange(client, recordId, previous);
      });
      await withTransaction(async (client) => {
        const previous = await lockRecordStatus(client, recordId);
        await enqueueStatusChange(client, recordId, previous);
      });
      await processDueDeliveries();
      const events = sentTo(endpoint.host).map((outgoing) => JSON.parse(outgoing.body));
      expect(events.map((event) => event.type)).toEqual([
        'record.created',
        'record.verification_changed',
      ]);
      expect(events[1].data).toMatchObject({
        recordId,
        status: 'verified',
        previousStatus: 'unverified',
      });
    }, 120_000);

    it('retries transient failures within a bounded budget and fails fast on client errors', async () => {
      const owner = await organizationSession();
      const endpoint = await activeEndpoint(owner);
      respond = () => ({ status: 503, body: 'unavailable' });

      expect((await createRecord(owner, Keypair.random(), 'Retry record')).status).toBe(201);
      const [pending] = await deliveriesFor(endpoint.id);
      expect(pending).toBeDefined();
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        await processDueDeliveries();
        const [row] = await deliveriesFor(endpoint.id);
        expect(row!.attempts).toBe(attempt);
        expect(row!.last_error).toBe('http_503');
        if (attempt < 3) {
          expect(row!.status).toBe('pending');
          expect(row!.next_attempt_at.getTime()).toBeGreaterThan(Date.now());
          await pool.query(
            'UPDATE notification_deliveries SET next_attempt_at = NOW() WHERE id = $1',
            [row!.id],
          );
        } else {
          expect(row!.status).toBe('failed');
        }
      }
      expect(sentTo(endpoint.host)).toHaveLength(3);
      await pool.query('UPDATE notification_deliveries SET next_attempt_at = NOW() WHERE id = $1', [
        pending!.id,
      ]);
      await processDueDeliveries();
      expect(sentTo(endpoint.host)).toHaveLength(3);

      respond = () => {
        throw new DeliveryError('connect_timeout', true);
      };
      expect((await createRecord(owner, Keypair.random(), 'Timeout record')).status).toBe(201);
      await processDueDeliveries();
      expect((await deliveriesFor(endpoint.id)).at(-1)).toMatchObject({
        status: 'pending',
        attempts: 1,
        last_error: 'connect_timeout',
      });
      await pool.query(
        `UPDATE notification_deliveries SET status = 'cancelled'
         WHERE endpoint_id = $1 AND status = 'pending'`,
        [endpoint.id],
      );

      sent.length = 0;
      respond = () => ({ status: 410, body: '' });
      expect((await createRecord(owner, Keypair.random(), 'Gone record')).status).toBe(201);
      await processDueDeliveries();
      expect((await deliveriesFor(endpoint.id)).at(-1)).toMatchObject({
        status: 'failed',
        attempts: 1,
        last_error: 'http_410',
      });
      expect(sentTo(endpoint.host)).toHaveLength(1);
    }, 120_000);

    it('cancels pending deliveries, and stops on revocation or a lost role', async () => {
      const owner = await organizationSession();
      const other = await organizationSession();
      const endpoint = await activeEndpoint(owner);

      expect((await createRecord(owner, Keypair.random(), 'Cancel record')).status).toBe(201);
      const [pending] = await deliveriesFor(endpoint.id);
      const cancelPath = `/api/notifications/deliveries/${pending!.id}/cancel`;
      expect((await endpointAction(other, 'post', cancelPath)).status).toBe(404);
      const cancelled = await endpointAction(owner, 'post', cancelPath);
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.delivery).toEqual({ id: pending!.id, status: 'cancelled' });
      expect((await endpointAction(owner, 'post', cancelPath)).status).toBe(409);
      await processDueDeliveries();
      expect(sentTo(endpoint.host)).toHaveLength(0);
      const listed = await request(app)
        .get('/api/notifications/deliveries')
        .query({ endpointId: endpoint.id })
        .set('Cookie', owner.cookie);
      expect(listed.status).toBe(200);
      expect(listed.body.deliveries[0]).toMatchObject({ id: pending!.id, status: 'cancelled' });
      expect(listed.body.deliveries[0]).not.toHaveProperty('payload');

      expect((await createRecord(owner, Keypair.random(), 'Revoke record')).status).toBe(201);
      const revoked = await endpointAction(
        owner,
        'delete',
        `/api/notifications/endpoints/${endpoint.id}`,
      );
      expect(revoked.status).toBe(200);
      expect(revoked.body.endpoint.status).toBe('revoked');
      expect((await deliveriesFor(endpoint.id)).map((row) => row.status)).toEqual([
        'cancelled',
        'cancelled',
      ]);
      expect((await createRecord(owner, Keypair.random(), 'After revoke')).status).toBe(201);
      expect(await deliveriesFor(endpoint.id)).toHaveLength(2);
      await processDueDeliveries();
      expect(sentTo(endpoint.host)).toHaveLength(0);

      // A queued delivery is cancelled, not sent, once its owner loses the organization role.
      const demoted = await organizationSession();
      const demotedEndpoint = await activeEndpoint(demoted);
      expect((await createRecord(demoted, Keypair.random(), 'Demoted record')).status).toBe(201);
      expect(await deliveriesFor(demotedEndpoint.id)).toHaveLength(1);
      await pool.query(`UPDATE wallet_roles SET role = 'donor' WHERE wallet_address = $1`, [
        demoted.address,
      ]);
      await processDueDeliveries();
      expect(sentTo(demotedEndpoint.host)).toHaveLength(0);
      expect((await deliveriesFor(demotedEndpoint.id))[0]).toMatchObject({
        status: 'cancelled',
        last_error: 'endpoint_inactive',
      });
    }, 120_000);
  });
});
