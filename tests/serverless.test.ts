import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  delete process.env.VERCEL;
  vi.resetModules();
});

describe('serverless runtime configuration', () => {
  it('caps the connection pool and shortens the idle timeout on Vercel', async () => {
    process.env.VERCEL = '1';
    const { pool } = await import('../server/db.js');

    expect(pool.options.max).toBe(3);
    expect(pool.options.idleTimeoutMillis).toBe(5_000);
    expect(pool.options.allowExitOnIdle).toBe(true);
  });

  it('keeps the long-running pool defaults outside Vercel', async () => {
    delete process.env.VERCEL;
    const { pool } = await import('../server/db.js');

    expect(pool.options.max).toBe(10);
    expect(pool.options.idleTimeoutMillis).toBe(30_000);
    expect(pool.options.allowExitOnIdle).toBe(false);
  });

  it('bounds idle-in-transaction sessions on every pooled connection', async () => {
    for (const vercel of ['1', undefined]) {
      if (vercel) process.env.VERCEL = vercel;
      else delete process.env.VERCEL;
      vi.resetModules();
      const { pool, IDLE_IN_TRANSACTION_TIMEOUT_MS } = await import('../server/db.js');

      expect(IDLE_IN_TRANSACTION_TIMEOUT_MS).toBe(30_000);
      expect(pool.options.idle_in_transaction_session_timeout).toBe(IDLE_IN_TRANSACTION_TIMEOUT_MS);
      // Only idle time inside a transaction counts; keep the bound above statement_timeout anyway.
      expect(IDLE_IN_TRANSACTION_TIMEOUT_MS).toBeGreaterThan(
        Number(pool.options.statement_timeout),
      );
    }
  });

  it('keeps the original error and discards the client when ROLLBACK fails', async () => {
    const { pool, withTransaction } = await import('../server/db.js');
    const terminated = new Error('terminating connection due to idle-in-transaction timeout');
    const queries: string[] = [];
    const release = vi.fn();
    const client = {
      query: vi.fn(async (text: string) => {
        queries.push(text);
        if (text === 'ROLLBACK') throw terminated;
        return { rows: [] };
      }),
      release,
    };
    const connect = vi.spyOn(pool, 'connect').mockResolvedValue(client as never);
    const workError = new Error('next statement failed');

    await expect(
      withTransaction(async () => {
        throw workError;
      }),
    ).rejects.toBe(workError);
    expect(queries).toEqual(['BEGIN', 'ROLLBACK']);
    expect(release).toHaveBeenCalledWith(terminated);
    connect.mockRestore();
  });

  it('releases the client normally after a successful ROLLBACK', async () => {
    const { pool, withTransaction } = await import('../server/db.js');
    const release = vi.fn();
    const client = { query: vi.fn(async () => ({ rows: [] })), release };
    const connect = vi.spyOn(pool, 'connect').mockResolvedValue(client as never);

    await expect(
      withTransaction(async () => {
        throw new Error('work failed');
      }),
    ).rejects.toThrow('work failed');
    expect(release).toHaveBeenCalledWith(undefined);
    connect.mockRestore();
  });

  it('exposes the Express app as the default Vercel Function handler', async () => {
    const handler = (await import('../api/index.js')).default;

    expect(typeof handler).toBe('function');
  });
});
