import { describe, expect, it, vi } from 'vitest';
import { cleanupEphemeralRows } from '../scripts/cleanup-ephemeral.js';

type QueryResult = { rowCount: number | null };

function createCleanupDependencies() {
  const state: { sessions: number; challenges: number; rateLimits: number } = {
    sessions: 0,
    challenges: 0,
    rateLimits: 0,
  };
  const query = vi.fn().mockImplementation((text: string) => {
    if (text.includes('DELETE FROM sessions')) {
      state.sessions += 1;
      return Promise.resolve({ rowCount: state.sessions > 1 ? 0 : 1 });
    }
    if (text.includes('DELETE FROM challenges')) {
      state.challenges += 1;
      return Promise.resolve({ rowCount: state.challenges > 1 ? 0 : 1 });
    }
    if (text.includes('DELETE FROM rate_limits')) {
      state.rateLimits += 1;
      return Promise.resolve({ rowCount: state.rateLimits > 1 ? 0 : 1 });
    }
    return Promise.resolve({ rowCount: 0 });
  });
  const client = { query, release: vi.fn() };
  const pool = {
    connect: vi.fn().mockResolvedValue(client),
    end: vi.fn().mockResolvedValue(undefined),
  };
  const createPool = vi.fn(() => pool);
  return { client, createPool, pool, query, state };
}

describe('cleanupEphemeralRows', () => {
  it('deletes expired rows in bounded batches and prints counts only', async () => {
    const { createPool, query, state } = createCleanupDependencies();

    const counts = await cleanupEphemeralRows(
      'postgresql://db.example/test',
      1000,
      createPool,
    );

    expect(counts).toEqual({ sessions: 1, challenges: 1, rateLimits: 1 });
    // Each table is queried once because the batch returned fewer than the batch size.
    expect(query).toHaveBeenCalledTimes(3);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('DELETE FROM sessions'),
      expect.anything(),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('DELETE FROM challenges'),
      expect.anything(),
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('DELETE FROM rate_limits'),
      expect.anything(),
    );
    // The DELETE statements target only the ephemeral tables.
    const sessionQuery = String(query.mock.calls[0]?.[0]);
    expect(sessionQuery).toContain('DELETE FROM sessions');
    expect(sessionQuery).not.toContain('audit_events');
    expect(sessionQuery).not.toContain('aid_records');
    // The condition targets expired or revoked rows only.
    expect(sessionQuery).toContain('expires_at < NOW() OR revoked_at IS NOT NULL');
    const challengeQuery = String(query.mock.calls[1]?.[0]);
    expect(challengeQuery).toContain('expires_at < NOW() OR used_at IS NOT NULL');
    const rateLimitQuery = String(query.mock.calls[2]?.[0]);
    expect(rateLimitQuery).toContain('expires_at < NOW()');
    // Bounded batch size is used in the LIMIT clause.
    expect(sessionQuery).toContain('LIMIT $1');
    expect(state.sessions).toBe(1);
  });

  it('is idempotent: a second run produces no further deletions', async () => {
    const { createPool, query } = createCleanupDependencies();
    // First call returns 1 row, second call returns 0 rows (idempotent re-run).
    let callCount = 0;
    query.mockImplementation((text: string) => {
      callCount += 1;
      if (text.includes('DELETE FROM sessions')) {
        const count = callCount <= 3 ? 1 : 0;
        return Promise.resolve({ rowCount: count });
      }
      if (text.includes('DELETE FROM challenges')) {
        const count = callCount <= 3 ? 1 : 0;
        return Promise.resolve({ rowCount: count });
      }
      if (text.includes('DELETE FROM rate_limits')) {
        const count = callCount <= 3 ? 1 : 0;
        return Promise.resolve({ rowCount: count });
      }
      return Promise.resolve({ rowCount: 0 });
    });

    const first = await cleanupEphemeralRows('postgresql://db.example/test', 1000, createPool);
    const second = await cleanupEphemeralRows('postgresql://db.example/test', 1000, createPool);

    expect(first).toEqual({ sessions: 1, challenges: 1, rateLimits: 1 });
    expect(second).toEqual({ sessions: 0, challenges: 0, rateLimits: 0 });
  });

  it('rejects an out-of-range batch size', async () => {
    const { createPool } = createCleanupDependencies();
    await expect(
      cleanupEphemeralRows('postgresql://db.example/test', 0, createPool),
    ).rejects.toThrow('Batch size must be an integer between 1 and 10000.');
    await expect(
      cleanupEphemeralRows('postgresql://db.example/test', 10001, createPool),
    ).rejects.toThrow('Batch size must be an integer between 1 and 10000.');
  });

  it('leaves unexpired rows, audit events, and aid records untouched', async () => {
    const { createPool, query } = createCleanupDependencies();
    // All DELETE statements return 0 rows (nothing expired).
    query.mockImplementation(() => Promise.resolve({ rowCount: 0 }));

    const counts = await cleanupEphemeralRows('postgresql://db.example/test', 1000, createPool);
    expect(counts).toEqual({ sessions: 0, challenges: 0, rateLimits: 0 });
    // No DELETE statements target audit_events or aid_records.
    for (const call of query.mock.calls) {
      const sql = String(call[0]);
      expect(sql).not.toContain('audit_events');
      expect(sql).not.toContain('aid_records');
    }
  });
});