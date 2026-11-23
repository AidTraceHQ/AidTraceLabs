import '../server/environment.js';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolConfig, type QueryResultRow } from 'pg';
import { Pool, type PoolClient, type PoolConfig } from 'pg';

const migrationDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));

/** "AIDT" in ASCII; identifies AidTrace's migration advisory lock. */
export const MIGRATION_ADVISORY_LOCK_KEY = 1_094_866_004;

type MigrationQueryResult<T extends QueryResultRow = QueryResultRow> = {
  rowCount: number | null;
  rows: T[];
};

export type MigrationClient = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<MigrationQueryResult<T>>;
  release(destroy?: boolean): void;
};

export type MigrationPool = {
  connect(): Promise<MigrationClient>;
  end(): Promise<void>;
};

export type MigrateOptions = {
  databaseUrl?: string;
  createPool?: (config: PoolConfig) => MigrationPool;
  migrationDirectory?: string;
};

export type MigrationRun = {
  status: 'completed' | 'locked';
  applied: string[];
};

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

const migrationPool = createMigrationPool(migrationUrl);

function databaseUrl(): string {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL or DATABASE_URL_UNPOOLED is required to run migrations.');
  }
  return url;
}

async function withTransaction<T>(
  pool: MigrationPool,
  work: (client: MigrationClient) => Promise<T>,
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

async function acquireMigrationLock(client: MigrationClient): Promise<boolean> {
  const result = await client.query<{ locked: boolean }>(
    'SELECT pg_try_advisory_lock($1::bigint) AS locked',
    [MIGRATION_ADVISORY_LOCK_KEY],
  );
  return result.rows[0]?.locked === true;
}

async function releaseMigrationLock(client: MigrationClient, held: boolean): Promise<void> {
  if (!held) {
    client.release();
    return;
  }
  let unlocked = false;
  try {
    await client.query('SELECT pg_advisory_unlock($1::bigint)', [MIGRATION_ADVISORY_LOCK_KEY]);
    unlocked = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      'Migration advisory lock could not be released explicitly; closing the database session instead.',
      message,
    );
  } finally {
    // Destroying the session is the only way to guarantee the lock is gone if the unlock failed.
    client.release(!unlocked);
  }
}

export async function applyUniqueNetworkTxHashMigration(client: MigrationClient) {
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

async function applyMigrations(
  pool: MigrationPool,
  client: MigrationClient,
  directory: string,
): Promise<string[]> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await readdir(directory))
    .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/.test(file))
    .sort();
  const applied: string[] = [];

  for (const file of files) {
    const version = file.slice(0, file.length - '.sql'.length);
    const alreadyApplied = await client.query(
      'SELECT 1 FROM schema_migrations WHERE version = $1',
      [version],
    );
    if (alreadyApplied.rowCount) continue;

    const sql = await readFile(join(directory, file), 'utf8');
    try {
      await withTransaction(pool, async (transaction) => {
        if (version === '002_unique_network_tx_hash') {
          await applyUniqueNetworkTxHashMigration(transaction);
        } else {
          await transaction.query(sql);
        }
        await transaction.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
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
    applied.push(version);
    console.log(`Applied migration ${version}.`);
  }
  return applied;
}

export async function migrate(options: MigrateOptions = {}): Promise<MigrationRun> {
  const createPool =
    options.createPool ?? ((config: PoolConfig) => new Pool(config) as unknown as MigrationPool);
  const pool = createPool({ connectionString: options.databaseUrl ?? databaseUrl() });
  try {
    const client = await pool.connect();
    let lockHeld = false;
    try {
      lockHeld = await acquireMigrationLock(client);
      if (!lockHeld) {
        return { status: 'locked', applied: [] };
      }
      const applied = await applyMigrations(
        pool,
        client,
        options.migrationDirectory ?? migrationDirectory,
      );
      return { status: 'completed', applied };
    } finally {
      await releaseMigrationLock(client, lockHeld);
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrate()
    .then((run) => {
      if (run.status === 'locked') {
        console.warn(
          'Another migration run holds the advisory lock; no migrations were applied by this run.',
        );
      }
    })
    .catch((error) => {
      console.error('Database migration failed:', error);
      process.exitCode = 1;
    });
}
