import './environment.js';
import { createHmac } from 'node:crypto';
import type { Pool } from 'pg';
import {
  MemoryStore,
  rateLimit,
  type ClientRateLimitInfo,
  type Options,
  type Store,
} from 'express-rate-limit';
import { pool } from './db.js';
import { integerEnvironmentVariable, rateLimitStoreKind } from './environment.js';

type RateLimiterOptions = { store?: Store };
type RateLimitLogger = Pick<Console, 'warn' | 'info'>;

export type PostgresRateLimitStoreOptions = {
  /** Pool used for the shared counters. Every instance must point at the same database. */
  pool?: Pick<Pool, 'query'>;
  /** Distinguishes limiters that share the table (for example `api:` and `auth:`). */
  prefix: string;
  /** Upper bound on how long a request waits for the shared store before falling back. */
  timeoutMs?: number;
  /** After a shared-store failure, how long to use per-instance counters before retrying. */
  retryMs?: number;
  /** HMAC key for stored key digests, so raw client IPs are never written to the database. */
  keySecret?: string;
  logger?: RateLimitLogger;
  now?: () => number;
};

const DEFAULT_RETRY_MS = 15_000;
const CLEANUP_INTERVAL_MS = 60_000;

class StoreTimeoutError extends Error {
  readonly code = 'RATE_LIMIT_STORE_TIMEOUT';
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new StoreTimeoutError()), timeoutMs);
    timer.unref?.();
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

function errorCode(error: unknown): string {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : 'unknown error';
}

/**
 * express-rate-limit store whose counters live in the PostgreSQL `rate_limits` table, so every
 * serverless instance connected to the same database enforces one shared fixed-window count.
 *
 * Failure policy: if the database errors or does not answer within `timeoutMs`, the request is
 * counted by an in-process MemoryStore instead (the pre-shared-store behavior), a warning is
 * logged, and the shared store is not retried for `retryMs`. Limits therefore degrade to
 * per-instance enforcement with bounded added latency; they are never switched off. The
 * in-process counters are kept warm on every request so a client already at the limit on an
 * instance stays limited there when the database drops out.
 */
export class PostgresRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;
  private readonly pool: Pick<Pool, 'query'>;
  private readonly timeoutMs: number;
  private readonly retryMs: number;
  private readonly keySecret: string;
  private readonly logger: RateLimitLogger;
  private readonly now: () => number;
  private readonly fallback = new MemoryStore();
  private windowMs = 60_000;
  private sharedRetryAt = 0;
  private nextCleanupAt = 0;
  private degradedSince: number | undefined;

  constructor(options: PostgresRateLimitStoreOptions) {
    this.prefix = options.prefix;
    this.pool = options.pool ?? pool;
    this.timeoutMs =
      options.timeoutMs ?? integerEnvironmentVariable('RATE_LIMIT_STORE_TIMEOUT_MS', 2000);
    this.retryMs = options.retryMs ?? DEFAULT_RETRY_MS;
    const keySecret = options.keySecret ?? process.env.SESSION_SECRET;
    if (!keySecret) throw new Error('PostgresRateLimitStore requires a key secret.');
    this.keySecret = keySecret;
    this.logger = options.logger ?? console;
    this.now = options.now ?? Date.now;
  }

  /** True while requests are counted per instance because the shared store is unavailable. */
  get degraded(): boolean {
    return this.degradedSince !== undefined;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const { keyHash, windowStart } = this.slot(key);
    return this.shared(
      async () => {
        const result = await this.pool.query<{ request_count: number; expires_at: Date }>(
          `SELECT request_count, expires_at FROM rate_limits
           WHERE key_hash = $1 AND window_start = $2`,
          [keyHash, windowStart],
        );
        const row = result.rows[0];
        return row ? { totalHits: row.request_count, resetTime: row.expires_at } : undefined;
      },
      () => this.fallback.get(key),
    );
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const local = await this.fallback.increment(key);
    const { keyHash, windowStart, expiresAt } = this.slot(key);
    return this.shared(
      async () => {
        const result = await this.pool.query<{ request_count: number }>(
          `INSERT INTO rate_limits (key_hash, window_start, request_count, expires_at)
           VALUES ($1, $2, 1, $3)
           ON CONFLICT (key_hash, window_start)
           DO UPDATE SET request_count = rate_limits.request_count + 1
           RETURNING request_count`,
          [keyHash, windowStart, expiresAt],
        );
        this.cleanupExpired();
        return { totalHits: result.rows[0].request_count, resetTime: expiresAt };
      },
      () => local,
    );
  }

  async decrement(key: string): Promise<void> {
    await this.fallback.decrement(key);
    const { keyHash, windowStart } = this.slot(key);
    await this.shared(
      async () => {
        await this.pool.query(
          `UPDATE rate_limits SET request_count = request_count - 1
           WHERE key_hash = $1 AND window_start = $2 AND request_count > 0`,
          [keyHash, windowStart],
        );
      },
      () => undefined,
    );
  }

  async resetKey(key: string): Promise<void> {
    await this.fallback.resetKey(key);
    const { keyHash } = this.slot(key);
    await this.shared(
      async () => {
        await this.pool.query('DELETE FROM rate_limits WHERE key_hash = $1', [keyHash]);
      },
      () => undefined,
    );
  }

  shutdown(): void {
    this.fallback.shutdown();
  }

  private slot(key: string) {
    const now = this.now();
    const windowStart = new Date(Math.floor(now / this.windowMs) * this.windowMs);
    const expiresAt = new Date(windowStart.getTime() + this.windowMs);
    const keyHash = createHmac('sha256', this.keySecret)
      .update('aidtrace-ip-rate-limit:')
      .update(this.prefix)
      .update(key)
      .digest('hex');
    return { keyHash, windowStart, expiresAt };
  }

  private async shared<T>(work: () => Promise<T>, local: () => T | Promise<T>): Promise<T> {
    if (this.now() < this.sharedRetryAt) return local();
    try {
      const result = await withTimeout(work(), this.timeoutMs);
      if (this.degradedSince !== undefined) {
        this.degradedSince = undefined;
        this.logger.info(`[rate-limit] Shared store recovered for "${this.prefix}" limiter.`);
      }
      return result;
    } catch (error) {
      this.sharedRetryAt = this.now() + this.retryMs;
      if (this.degradedSince === undefined) {
        this.degradedSince = this.now();
        // Log only the error code: driver messages can contain database hostnames.
        this.logger.warn(
          `[rate-limit] Shared store unavailable for "${this.prefix}" limiter ` +
            `(${errorCode(error)}); enforcing per-instance limits and retrying in ${this.retryMs} ms.`,
        );
      }
      return local();
    }
  }

  /** Opportunistically removes a bounded batch of expired counters, at most once a minute. */
  private cleanupExpired(): void {
    const now = this.now();
    if (now < this.nextCleanupAt) return;
    this.nextCleanupAt = now + CLEANUP_INTERVAL_MS;
    withTimeout(
      this.pool.query(
        `DELETE FROM rate_limits WHERE ctid IN (
           SELECT ctid FROM rate_limits WHERE expires_at < NOW() LIMIT 500
         )`,
      ),
      this.timeoutMs,
    ).catch(() => {
      // Housekeeping only; the next interval retries.
    });
  }
}

function configuredStore(prefix: string): Store | undefined {
  // `memory` keeps express-rate-limit's per-process MemoryStore; it is rejected in production
  // and on Vercel by validateEnvironment().
  return rateLimitStoreKind() === 'postgres' ? new PostgresRateLimitStore({ prefix }) : undefined;
}

export function createIpRateLimiter(
  windowMs: number,
  limit: number,
  options: RateLimiterOptions = {},
) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'rate_limit_exceeded' },
    ...(options.store ? { store: options.store } : {}),
  });
}

export function createApiIpRateLimiter(
  windowMs: number,
  limit: number,
  options: RateLimiterOptions = {},
) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'rate_limit_exceeded' },
    skip: (request) =>
      request.method === 'GET' &&
      (request.path === '/transparency' || request.path === '/_healthcheck'),
    ...(options.store ? { store: options.store } : {}),
  });
}

export const apiIpRateLimit = createApiIpRateLimiter(
  integerEnvironmentVariable('API_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  integerEnvironmentVariable('API_RATE_LIMIT_MAX', 120),
  { store: configuredStore('api:') },
);

export const publicReadIpRateLimit = createIpRateLimiter(
  integerEnvironmentVariable('PUBLIC_READ_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  integerEnvironmentVariable('PUBLIC_READ_RATE_LIMIT_MAX', 600),
  { store: configuredStore('public-read:') },
);

export const authIpRateLimit = createIpRateLimiter(
  integerEnvironmentVariable('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  integerEnvironmentVariable('AUTH_RATE_LIMIT_MAX', 20),
  { store: configuredStore('auth:') },
);
