import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../server/app.js';
import {
  checkDatabaseReadiness,
  databaseReadinessTimeoutMs,
  isTransientDatabaseError,
} from '../server/database-errors.js';
import { pool } from '../server/db.js';

function errorWithCode(code: string): Error {
  return Object.assign(new Error('x'), { code });
}

describe('isTransientDatabaseError', () => {
  const transientCodes = [
    'ECONNREFUSED',
    'EPIPE',
    '08000',
    '08001',
    '08003',
    '08004',
    '08006',
    '57P01',
    '53300',
  ];

  it.each(transientCodes)('classifies top-level %s as transient', (code) => {
    expect(isTransientDatabaseError(errorWithCode(code))).toBe(true);
  });

  it.each(transientCodes)('classifies %s nested in cause as transient', (code) => {
    expect(isTransientDatabaseError(new Error('outer', { cause: errorWithCode(code) }))).toBe(true);
  });

  const nonTransientCodes = ['23505', '23503', '23514', '08P01'];

  it.each(nonTransientCodes)('does not classify top-level %s as transient', (code) => {
    expect(isTransientDatabaseError(errorWithCode(code))).toBe(false);
  });

  it.each(nonTransientCodes)('does not classify %s nested in cause as transient', (code) => {
    expect(isTransientDatabaseError(new Error('outer', { cause: errorWithCode(code) }))).toBe(
      false,
    );
  });

  it('returns false for a cyclic cause chain without throwing', () => {
    const first = new Error('first');
    const second = new Error('second', { cause: first });
    first.cause = second;

    expect(() => isTransientDatabaseError(first)).not.toThrow();
    expect(isTransientDatabaseError(first)).toBe(false);
  });

  it('returns false for a self-referencing cause', () => {
    const error = new Error('self');
    error.cause = error;

    expect(isTransientDatabaseError(error)).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'ECONNREFUSED'],
    ['a plain object without code', { message: 'nope' }],
  ])('returns false for %s', (_label, value) => {
    expect(isTransientDatabaseError(value)).toBe(false);
  });
});

describe('transient database failures on public GET routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('retries once and responds with a sanitized 503 when the retry also fails', async () => {
    const databaseError = Object.assign(
      new Error('Connection terminated unexpectedly; do-not-leak-this'),
      { code: 'EAI_AGAIN' },
    );
    const query = vi.spyOn(pool, 'query').mockRejectedValue(databaseError);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(app).get('/api/transparency');

    expect(query).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'database_unavailable' });
    expect(JSON.stringify(response.body)).not.toContain('do-not-leak-this');
    expect(log).toHaveBeenCalledWith('Database failure GET /api/transparency (Error)');
  });

  it('retries once and responds with a sanitized 503 on admin shutdown (57P01)', async () => {
    const databaseError = Object.assign(
      new Error('terminating connection due to administrator command; do-not-leak-this'),
      { code: '57P01' },
    );
    const query = vi.spyOn(pool, 'query').mockRejectedValue(databaseError);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(app).get('/api/transparency');

    expect(query).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'database_unavailable' });
    expect(JSON.stringify(response.body)).not.toContain('do-not-leak-this');
  });
});

describe('checkDatabaseReadiness', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports ready when the probe resolves', async () => {
    await expect(checkDatabaseReadiness(async () => ({ rows: [] }))).resolves.toEqual({
      ready: true,
    });
  });

  it('uses a timeout of a few seconds by default', () => {
    expect(databaseReadinessTimeoutMs).toBeGreaterThanOrEqual(1_000);
    expect(databaseReadinessTimeoutMs).toBeLessThanOrEqual(5_000);
  });

  it('classifies a transient failure as unavailable and logs only the error class', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = Object.assign(new Error('connect ECONNREFUSED secret-host:5432'), {
      code: 'ECONNREFUSED',
    });

    await expect(checkDatabaseReadiness(() => Promise.reject(error))).resolves.toEqual({
      ready: false,
      reason: 'unavailable',
    });
    expect(log).toHaveBeenCalledWith('Database readiness check failed (unavailable, Error)');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-host');
  });

  it('classifies a non-transient failure as error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      checkDatabaseReadiness(() => Promise.reject(errorWithCode('28P01'))),
    ).resolves.toEqual({ ready: false, reason: 'error' });
  });

  it('classifies a synchronous throw as a failure instead of rejecting', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      checkDatabaseReadiness(() => {
        throw new Error('sync');
      }),
    ).resolves.toEqual({ ready: false, reason: 'error' });
  });

  it('times out a probe that never settles', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const started = Date.now();

    await expect(checkDatabaseReadiness(() => new Promise(() => {}), 25)).resolves.toEqual({
      ready: false,
      reason: 'timeout',
    });
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('ignores a probe that rejects after the timeout', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const late = new Promise((_resolve, reject) => setTimeout(() => reject(new Error('late')), 50));

    await expect(checkDatabaseReadiness(() => late, 10)).resolves.toEqual({
      ready: false,
      reason: 'timeout',
    });
    await expect(late).rejects.toThrow('late');
  });
});
