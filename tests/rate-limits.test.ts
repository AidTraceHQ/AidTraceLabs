import { randomInt, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { rateLimitStoreKind } from '../server/environment.js';
import {
  PostgresRateLimitStore,
  createApiIpRateLimiter,
  createIpRateLimiter,
} from '../server/rate-limits.js';

const keySecret = 'vitest-rate-limit-key-secret-with-32-bytes';

function appWith(limiter: express.RequestHandler, trustProxyHops = 0) {
  const app = express();
  app.set('trust proxy', trustProxyHops);
  app.use('/api', limiter);
  app.get('/api/test', (_request, response) => response.json({ ok: true }));
  return app;
}

function quietLogger() {
  return { warn: vi.fn(), info: vi.fn() };
}

describe('per-IP API rate limiter', () => {
  it('returns 429 with Retry-After when the configured limit is exceeded', async () => {
    const app = express();
    const publicReadLimiter = createIpRateLimiter(60_000, 2);
    app.use('/api', createApiIpRateLimiter(60_000, 1));
    app.get('/api/transparency', publicReadLimiter, (_request, response) =>
      response.json({ ok: true }),
    );
    app.get('/api/_healthcheck', publicReadLimiter, (_request, response) =>
      response.json({ ok: true }),
    );
    app.get('/api/test', (_request, response) => response.json({ ok: true }));

    const allowed = await request(app).get('/api/test');
    const limited = await request(app).get('/api/test');
    const publicFirst = await request(app).get('/api/transparency');
    const publicSecond = await request(app).get('/api/_healthcheck');
    const publicThird = await request(app).get('/api/transparency');

    expect(allowed.status).toBe(200);
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      error: 'Too many requests. Wait a few minutes and try again.',
      code: 'rate_limit_exceeded',
    });
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(publicFirst.status).toBe(200);
    expect(publicSecond.status).toBe(200);
    expect(publicThird.status).toBe(429);
    expect(publicThird.body).toEqual({
      error: 'Too many requests. Wait a few minutes and try again.',
      code: 'rate_limit_exceeded',
    });
    expect(Number(publicThird.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('keys clients by the forwarded IP only when a proxy hop is trusted', async () => {
    const trusted = appWith(createApiIpRateLimiter(60_000, 1), 1);
    const first = await request(trusted).get('/api/test').set('X-Forwarded-For', '203.0.113.10');
    const otherClient = await request(trusted)
      .get('/api/test')
      .set('X-Forwarded-For', '203.0.113.11');
    const repeat = await request(trusted).get('/api/test').set('X-Forwarded-For', '203.0.113.10');
    expect([first.status, otherClient.status, repeat.status]).toEqual([200, 200, 429]);

    // Without trusted hops a client cannot escape its limit by rotating X-Forwarded-For.
    const direct = appWith(createApiIpRateLimiter(60_000, 1), 0);
    const directFirst = await request(direct)
      .get('/api/test')
      .set('X-Forwarded-For', '203.0.113.10');
    const spoofed = await request(direct).get('/api/test').set('X-Forwarded-For', '203.0.113.11');
    expect([directFirst.status, spoofed.status]).toEqual([200, 429]);
  });
});

describe('rate-limit store configuration', () => {
  it('defaults to the shared PostgreSQL store', () => {
    expect(rateLimitStoreKind({})).toBe('postgres');
    expect(rateLimitStoreKind({ RATE_LIMIT_STORE: ' Postgres ' })).toBe('postgres');
    expect(rateLimitStoreKind({ RATE_LIMIT_STORE: 'memory', NODE_ENV: 'development' })).toBe(
      'memory',
    );
  });

  it('rejects unknown stores and per-process counters in production or on Vercel', () => {
    expect(() => rateLimitStoreKind({ RATE_LIMIT_STORE: 'redis' })).toThrow(
      'RATE_LIMIT_STORE must be "postgres" or "memory".',
    );
    expect(() =>
      rateLimitStoreKind({ RATE_LIMIT_STORE: 'memory', NODE_ENV: 'production' }),
    ).toThrow(/does not share limits across instances/);
    expect(() =>
      rateLimitStoreKind({ RATE_LIMIT_STORE: 'memory', NODE_ENV: 'development', VERCEL: '1' }),
    ).toThrow(/does not share limits across instances/);
  });
});

describe('PostgresRateLimitStore when the shared store is unavailable', () => {
  it('keeps enforcing the limit per instance, logs once without hostnames, and backs off', async () => {
    const query = vi.fn().mockRejectedValue(
      Object.assign(new Error('connect ECONNREFUSED db.internal.example:5432'), {
        code: 'ECONNREFUSED',
      }),
    );
    const logger = quietLogger();
    const store = new PostgresRateLimitStore({
      pool: { query } as never,
      prefix: 'api:',
      keySecret,
      logger,
      retryMs: 60_000,
    });
    const app = appWith(createApiIpRateLimiter(60_000, 2, { store }));

    const statuses = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      statuses.push((await request(app).get('/api/test')).status);
    }

    expect(statuses).toEqual([200, 200, 429, 429]);
    expect(store.degraded).toBe(true);
    // Only the first request waited on the database; the rest used the back-off window.
    expect(query).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const warning = String(logger.warn.mock.calls[0][0]);
    expect(warning).toContain('ECONNREFUSED');
    expect(warning).toContain('per-instance limits');
    expect(warning).not.toContain('db.internal.example');
    expect(warning).not.toContain('127.0.0.1');
  });

  it('bounds the wait on a hanging store by the configured timeout', async () => {
    const query = vi.fn(() => new Promise(() => {}));
    const logger = quietLogger();
    const store = new PostgresRateLimitStore({
      pool: { query } as never,
      prefix: 'auth:',
      keySecret,
      logger,
      timeoutMs: 50,
    });
    const app = appWith(createIpRateLimiter(60_000, 1, { store }));

    const startedAt = Date.now();
    const allowed = await request(app).get('/api/test');
    const limited = await request(app).get('/api/test');

    expect(Date.now() - startedAt).toBeLessThan(2_000);
    expect(allowed.status).toBe(200);
    expect(limited.status).toBe(429);
    expect(String(logger.warn.mock.calls[0][0])).toContain('RATE_LIMIT_STORE_TIMEOUT');
  });

  it('returns to the shared count after the back-off and logs the recovery', async () => {
    let available = false;
    let sharedHits = 0;
    let now = 1_000_000;
    const query = vi.fn(async (text: string) => {
      if (!available) throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
      if (text.includes('INSERT INTO rate_limits')) {
        sharedHits += 1;
        return { rows: [{ request_count: sharedHits }] };
      }
      return { rows: [] };
    });
    const logger = quietLogger();
    const store = new PostgresRateLimitStore({
      pool: { query } as never,
      prefix: 'public-read:',
      keySecret,
      logger,
      retryMs: 1_000,
      now: () => now,
    });
    const app = appWith(createIpRateLimiter(60_000, 3, { store }));

    expect((await request(app).get('/api/test')).status).toBe(200);
    expect(store.degraded).toBe(true);

    available = true;
    sharedHits = 3; // Other instances have used the whole shared allowance meanwhile.
    now += 1_001;
    const limited = await request(app).get('/api/test');

    expect(limited.status).toBe(429);
    expect(store.degraded).toBe(false);
    expect(logger.info).toHaveBeenCalledWith(
      '[rate-limit] Shared store recovered for "public-read:" limiter.',
    );
  });
});

const sharedStoreIntegration = describe.skipIf(!process.env.TEST_DATABASE_URL);

sharedStoreIntegration('PostgresRateLimitStore shared across app instances', () => {
  // An isolated schema keeps this suite independent of the migration run in other test files.
  const schema = `rate_limit_test_${randomUUID().replaceAll('-', '')}`;
  const connectionString =
    process.env.TEST_DATABASE_URL_UNPOOLED || (process.env.TEST_DATABASE_URL as string);
  const pools: Pool[] = [];

  function instancePool() {
    const pool = new Pool({ connectionString, max: 2, options: `-c search_path=${schema}` });
    pools.push(pool);
    return pool;
  }

  function appInstance(prefix: string) {
    const store = new PostgresRateLimitStore({
      pool: instancePool(),
      prefix,
      keySecret,
      logger: quietLogger(),
    });
    // Vercel forwards the client address through one trusted proxy hop.
    return { app: appWith(createApiIpRateLimiter(60_000, 2, { store }), 1), store };
  }

  beforeAll(async () => {
    const migration = await readFile(
      new URL('../migrations/001_initial_schema.sql', import.meta.url),
      'utf8',
    );
    const ddl = migration.match(
      /CREATE TABLE rate_limits \([\s\S]*?\);\s*CREATE INDEX rate_limits_expiry_idx[^;]*;/,
    );
    if (!ddl) throw new Error('rate_limits DDL not found in migration 001.');
    const admin = instancePool();
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(ddl[0]);
  });

  afterAll(async () => {
    try {
      await pools[0]?.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      await Promise.all(pools.map((pool) => pool.end()));
    }
  });

  it('returns 429 from instance B after instance A exhausts the limit for the same IP', async () => {
    const instanceA = appInstance('api:');
    const instanceB = appInstance('api:');
    const clientIp = `198.51.100.${randomInt(1, 255)}`;
    const otherIp = `192.0.2.${randomInt(1, 255)}`;

    const fromA = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      fromA.push(
        (await request(instanceA.app).get('/api/test').set('X-Forwarded-For', clientIp)).status,
      );
    }
    const fromB = await request(instanceB.app).get('/api/test').set('X-Forwarded-For', clientIp);
    const otherClientOnB = await request(instanceB.app)
      .get('/api/test')
      .set('X-Forwarded-For', otherIp);

    expect(fromA).toEqual([200, 200, 429]);
    expect(fromB.status).toBe(429);
    expect(fromB.body).toEqual({ error: 'rate_limit_exceeded' });
    expect(Number(fromB.headers['retry-after'])).toBeGreaterThan(0);
    expect(otherClientOnB.status).toBe(200);
    expect(instanceA.store.degraded).toBe(false);
    expect(instanceB.store.degraded).toBe(false);

    const stored = await pools[0].query<{ key_hash: string; request_count: number }>(
      'SELECT key_hash, request_count FROM rate_limits ORDER BY request_count DESC',
    );
    expect(stored.rows.map((row) => row.request_count)).toEqual([4, 1]);
    for (const row of stored.rows) {
      expect(row.key_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.key_hash).not.toContain(clientIp);
    }
  });
});
