import { Keypair } from '@stellar/stellar-sdk';
import { describe, expect, it, vi } from 'vitest';
import { seedAdmin } from '../scripts/seed-admin.js';

function createSeedDependencies(query = vi.fn().mockResolvedValue(undefined)) {
  const client = {
    query,
    release: vi.fn(),
  };
  const pool = {
    connect: vi.fn().mockResolvedValue(client),
    end: vi.fn().mockResolvedValue(undefined),
  };
  const createPool = vi.fn(() => pool);
  return { client, createPool, pool, query };
}

describe('admin seed script', () => {
  it('sets the admin role and closes the pool on success', async () => {
    const wallet = Keypair.random().publicKey();
    const { client, createPool, pool, query } = createSeedDependencies();

    await expect(seedAdmin(wallet, 'postgresql://db.example/test', createPool))
      .resolves.toBe(`Admin role set for G...${wallet.slice(-6)}`);

    expect(query).toHaveBeenCalledTimes(4);
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO users'), [wallet]);
    expect(query).toHaveBeenNthCalledWith(3, expect.stringContaining('INSERT INTO wallet_roles'), [wallet]);
    expect(client.release).toHaveBeenCalledOnce();
    expect(pool.end).toHaveBeenCalledOnce();
    expect(createPool).toHaveBeenCalledWith(expect.objectContaining({
      connectionTimeoutMillis: 10_000,
      query_timeout: 10_000,
      statement_timeout: 10_000,
    }));
  });

  it('rolls back and closes the pool when a database write fails', async () => {
    const wallet = Keypair.random().publicKey();
    const databaseError = new Error('role insert failed');
    const query = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(databaseError)
      .mockResolvedValueOnce(undefined);
    const { client, pool } = createSeedDependencies(query);

    await expect(seedAdmin(wallet, 'postgresql://db.example/test', () => pool))
      .rejects.toBe(databaseError);

    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
    expect(pool.end).toHaveBeenCalledOnce();
  });
});
