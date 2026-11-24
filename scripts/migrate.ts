import '../server/environment.js';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient, type PoolConfig } from 'pg';

const migrationDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));
const migrationUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!migrationUrl) {
  throw new Error('DATABASE_URL or DATABASE_URL_UNPOOLED is required to run migrations.');
}
const resolvedMigrationUrl: string = migrationUrl;

// Bounds a migration that would otherwise wait on a lock or a stalled connection forever.
// Mirrors the runtime (server/db.ts) and seed (scripts/seed-admin.ts) pools.
export const MIGRATION_TIMEOUT_MS = 10_000;

type MigrationPoolFactory = (config: PoolConfig) => Pool;

export function createMigrationPool(
  databaseUrl: string,
  createPool: MigrationPoolFactory = (config) => new Pool(config),
): Pool {
  return createPool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: MIGRATION_TIMEOUT_MS,
    query_timeout: MIGRATION_TIMEOUT_MS,
    statement_timeout: MIGRATION_TIMEOUT_MS,
  });
}

export function migrationChecksum(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

export class MigrationChecksumError extends Error {
  constructor(
    readonly version: string,
    message: string,
  ) {
    super(message);
    this.name = 'MigrationChecksumError';
  }
}

export type MigrationOptions = {
  migrationDirectory?: string;
  baselineChecksums?: boolean;
};

async function withTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

type DuplicateHash = {
  id: string;
  network: string;
  tx_hash: string;
  duplicate_count: string;
};

export class DuplicateTransactionHashesError extends Error {
  constructor(readonly duplicates: DuplicateHash[]) {
    super('Resolve the reported duplicate aid records before applying the unique-hash migration.');
    this.name = 'DuplicateTransactionHashesError';
  }
}

export async function applyUniqueNetworkTxHashMigration(
  client: Pick<import('pg').PoolClient, 'query'>,
) {
  const duplicates = await client.query<DuplicateHash>(`
    SELECT id, network, tx_hash, duplicate_count
    FROM (
      SELECT id, network, tx_hash,
             COUNT(*) OVER (PARTITION BY network, LOWER(tx_hash)) AS duplicate_count
      FROM aid_records
      WHERE tx_hash IS NOT NULL AND BTRIM(tx_hash) <> ''
    ) duplicate_records
    WHERE duplicate_count > 1
    ORDER BY network, LOWER(tx_hash), id
  `);
  if (duplicates.rowCount) {
    throw new DuplicateTransactionHashesError(duplicates.rows);
  }
  await client.query(
    await readFile(join(migrationDirectory, '002_unique_network_tx_hash.sql'), 'utf8'),
  );
}

export async function runMigrations(pool: Pool, options: MigrationOptions = {}): Promise<string[]> {
  const directory = options.migrationDirectory ?? migrationDirectory;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checksum TEXT
    )
  `);
  await pool.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT');

  const files = (await readdir(directory))
    .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/.test(file))
    .sort();

  const appliedRows = await pool.query<{ version: string; checksum: string | null }>(
    'SELECT version, checksum FROM schema_migrations',
  );
  const applied = new Map(appliedRows.rows.map((row) => [row.version, row.checksum]));

  const pending: { version: string; sql: string; checksum: string }[] = [];
  const baselines: { version: string; checksum: string }[] = [];
  for (const file of files) {
    const version = file.slice(0, file.length - '.sql'.length);
    const sql = await readFile(join(directory, file), 'utf8');
    const checksum = migrationChecksum(sql);
    if (!applied.has(version)) {
      pending.push({ version, sql, checksum });
      continue;
    }

    const stored = applied.get(version);
    if (stored === null) {
      if (!options.baselineChecksums) {
        throw new MigrationChecksumError(
          version,
          `Migration ${version} has no recorded checksum. Review the file, then run ` +
            '`npm run db:migrate -- --baseline-checksums` to record reviewed baselines.',
        );
      }
      baselines.push({ version, checksum });
      continue;
    }
    if (stored !== checksum) {
      throw new MigrationChecksumError(
        version,
        `Migration ${version} changed after it was applied. ` +
          `Expected checksum ${stored}, found ${checksum}. ` +
          'Restore the file or add a new migration instead of editing it.',
      );
    }
  }

  // Verify every applied checksum before writing baselines or applying anything, so a
  // mismatch fails closed without partially migrating the database.
  for (const baseline of baselines) {
    await pool.query('UPDATE schema_migrations SET checksum = $2 WHERE version = $1', [
      baseline.version,
      baseline.checksum,
    ]);
    console.log(`Recorded reviewed baseline checksum for migration ${baseline.version}.`);
  }

  const appliedNow: string[] = [];
  for (const migration of pending) {
    try {
      await withTransaction(pool, async (client) => {
        if (migration.version === '002_unique_network_tx_hash') {
          await applyUniqueNetworkTxHashMigration(client);
        } else {
          await client.query(migration.sql);
        }
        await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [
          migration.version,
          migration.checksum,
        ]);
      });
    } catch (error) {
      if (error instanceof DuplicateTransactionHashesError) {
        console.error(
          'Migration 002 aborted: duplicate network/transaction hashes require resolution:',
        );
        console.error(JSON.stringify(error.duplicates, null, 2));
      }
      throw error;
    }
    console.log(`Applied migration ${migration.version}.`);
    appliedNow.push(migration.version);
  }
  return appliedNow;
}

export async function migrate(options: MigrationOptions = {}): Promise<string[]> {
  const pool = createMigrationPool(resolvedMigrationUrl);
  try {
    return await runMigrations(pool, options);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrate({ baselineChecksums: process.argv.includes('--baseline-checksums') }).catch((error) => {
    console.error('Database migration failed:', error);
    process.exitCode = 1;
  });
}
