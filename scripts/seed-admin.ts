import '../server/environment.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { StrKey } from '@stellar/stellar-sdk';
import { Pool, type PoolConfig } from 'pg';

type SeedClient = {
  query(text: string, values?: unknown[]): Promise<unknown>;
  release(): void;
};
type SeedPool = {
  connect(): Promise<SeedClient>;
  end(): Promise<void>;
};

const connectionTimeoutMs = 10_000;

export async function seedAdmin(
  address: string,
  databaseUrl: string,
  createPool: (config: PoolConfig) => SeedPool = (config) => new Pool(config),
): Promise<string> {
  if (!address) {
    throw new Error('ADMIN_WALLET is required.');
  }
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new Error('ADMIN_WALLET must contain a Stellar public G-address.');
  }

  const pool = createPool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: connectionTimeoutMs,
    query_timeout: connectionTimeoutMs,
    statement_timeout: connectionTimeoutMs,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO users (wallet_address)
         VALUES ($1)
         ON CONFLICT (wallet_address) DO NOTHING`,
        [address],
      );
      await client.query(
        `INSERT INTO wallet_roles (wallet_address, role, updated_by)
         VALUES ($1, 'admin', $1)
         ON CONFLICT (wallet_address)
         DO UPDATE SET role = 'admin', updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [address],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return `Admin role set for G...${address.slice(-6)}`;
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const address = process.env.ADMIN_WALLET;
  const databaseUrl = process.env.DATABASE_URL;
  try {
    if (!address) {
      throw new Error('ADMIN_WALLET is required.');
    }
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required.');
    }
    console.log(await seedAdmin(address, databaseUrl));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    let safeMessage = message;
    if (databaseUrl) {
      safeMessage = safeMessage.replaceAll(databaseUrl, '[redacted DATABASE_URL]');
    }
    if (address) {
      safeMessage = safeMessage.replaceAll(address, '[redacted ADMIN_WALLET]');
    }
    console.error(safeMessage);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
