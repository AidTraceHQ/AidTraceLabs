import { Keypair } from '@stellar/stellar-sdk';
import { describe, expect, it, vi } from 'vitest';
import { main, seedAdmin } from '../scripts/seed-admin.js';

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
  it.each(['dev', 'test', 'demo', 'production'])(
    'sets exactly one admin role for the confirmed %s target',
    async (target) => {
      const wallet = Keypair.random().publicKey();
      const databaseUrl = 'postgresql://db.example/test';
      const { client, createPool, pool, query } = createSeedDependencies();

      const output = await seedAdmin(wallet, databaseUrl, target, target, createPool);

      expect(output).toBe(`Admin role set for target ${target}; wallet G...${wallet.slice(-6)}`);
      expect(output).not.toContain(databaseUrl);
      expect(output).not.toContain(wallet);
      expect(query).toHaveBeenCalledTimes(4);
      expect(
        query.mock.calls.filter(([statement]) => statement.includes('INSERT INTO wallet_roles')),
      ).toHaveLength(1);
      expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO users'), [
        wallet,
      ]);
      expect(query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO wallet_roles'),
        [wallet],
      );
      expect(client.release).toHaveBeenCalledOnce();
      expect(pool.end).toHaveBeenCalledOnce();
      expect(createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionTimeoutMillis: 10_000,
          query_timeout: 10_000,
          statement_timeout: 10_000,
        }),
      );
    },
  );

  it.each([
    ['missing target', undefined, undefined],
    ['missing confirmation', 'demo', undefined],
    ['mismatched confirmation', 'demo', 'production'],
  ])('rejects a %s before creating the pool', async (_case, target, confirmation) => {
    const wallet = Keypair.random().publicKey();
    const { createPool, query } = createSeedDependencies();

    await expect(
      seedAdmin(wallet, 'postgresql://db.example/test', target, confirmation, createPool),
    ).rejects.toThrow();

    expect(createPool).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ['missing confirmation', { ADMIN_SEED_TARGET: 'demo' }],
    ['mismatched confirmation', { ADMIN_SEED_TARGET: 'demo', ADMIN_SEED_CONFIRM_TARGET: 'test' }],
  ])('exits non-zero for a %s without writing a role', async (_case, confirmation) => {
    const wallet = Keypair.random().publicKey();
    const { createPool, query } = createSeedDependencies();
    const errorOutput = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitCode = process.exitCode;

    try {
      process.exitCode = 0;
      await main(
        {
          ADMIN_WALLET: wallet,
          DATABASE_URL: 'postgresql://db.example/test',
          ...confirmation,
        },
        createPool,
      );

      expect(process.exitCode).toBe(1);
      expect(createPool).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    } finally {
      process.exitCode = exitCode;
      errorOutput.mockRestore();
    }
  });

  it('prints only the confirmed target and wallet suffix on success', async () => {
    const wallet = Keypair.random().publicKey();
    const databaseUrl = 'postgresql://db.example/test';
    const { createPool, query } = createSeedDependencies();
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorOutput = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitCode = process.exitCode;

    try {
      process.exitCode = 0;
      await main(
        {
          ADMIN_WALLET: wallet,
          DATABASE_URL: databaseUrl,
          ADMIN_SEED_TARGET: 'demo',
          ADMIN_SEED_CONFIRM_TARGET: 'demo',
        },
        createPool,
      );

      expect(process.exitCode).toBe(0);
      expect(output).toHaveBeenCalledOnce();
      const printed = output.mock.calls[0][0];
      expect(printed).toBe(`Admin role set for target demo; wallet G...${wallet.slice(-6)}`);
      expect(printed).not.toContain(wallet);
      expect(printed).not.toContain(databaseUrl);
      expect(
        query.mock.calls.filter(([statement]) => statement.includes('INSERT INTO wallet_roles')),
      ).toHaveLength(1);
    } finally {
      process.exitCode = exitCode;
      output.mockRestore();
      errorOutput.mockRestore();
    }
  });

  it('rolls back and closes the pool when a database write fails', async () => {
    const wallet = Keypair.random().publicKey();
    const databaseError = new Error('role insert failed');
    const query = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(databaseError)
      .mockResolvedValueOnce(undefined);
    const { client, pool } = createSeedDependencies(query);

    await expect(
      seedAdmin(wallet, 'postgresql://db.example/test', 'test', 'test', () => pool),
    ).rejects.toBe(databaseError);

    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
    expect(pool.end).toHaveBeenCalledOnce();
  });
});
