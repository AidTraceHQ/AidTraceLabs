import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../server/app.js';
import { isTransientDatabaseError } from '../server/database-errors.js';
import { pool, withTransaction } from '../server/db.js';

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

describe('withTransaction error preservation', () => {
  afterEach(() => vi.restoreAllMocks());

  function makeClient(rollbackError?: Error) {
    const release = vi.fn();
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql === 'ROLLBACK' && rollbackError) throw rollbackError;
        return { rows: [] };
      }),
      release,
    };
    vi.spyOn(pool, 'connect').mockResolvedValue(client as never);
    return { client, release };
  }

  it('preserves the work error as the primary rejection', async () => {
    makeClient();
    const workError = new Error('work failed');

    await expect(
      withTransaction(async () => {
        throw workError;
      }),
    ).rejects.toBe(workError);
  });

  it('surfaces a rollback failure without claiming success', async () => {
    const workError = new Error('work failed');
    const rollbackError = new Error('rollback failed');
    makeClient(rollbackError);

    let caught: unknown;
    try {
      await withTransaction(async () => {
        throw workError;
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(workError);
    expect((caught as Error).cause).toBe(rollbackError);
  });

  it('releases the client exactly once', async () => {
    const { release } = makeClient(new Error('rollback failed'));

    await expect(
      withTransaction(async () => {
        throw new Error('work failed');
      }),
    ).rejects.toThrow('work failed');

    expect(release).toHaveBeenCalledTimes(1);
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
