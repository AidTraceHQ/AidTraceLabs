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

  it('exposes the Express app as the default Vercel Function handler', async () => {
    const handler = (await import('../api/index.js')).default;

    expect(typeof handler).toBe('function');
  });
});
