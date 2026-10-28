import '../server/environment.js';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';

const migrationDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));
const migrationUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!migrationUrl) {
  throw new Error('DATABASE_URL or DATABASE_URL_UNPOOLED is required to run migrations.');
}
const migrationPool = new Pool({ connectionString: migrationUrl });

async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await migrationPool.connect();
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
  await client.query(await readFile(join(migrationDirectory, '002_unique_network_tx_hash.sql'), 'utf8'));
}

export async function migrate() {
  try {
    await migrationPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

    const files = (await readdir(migrationDirectory))
      .filter(file => /^\d{3}_[a-z0-9_]+\.sql$/.test(file))
      .sort();

    for (const file of files) {
      const version = file.slice(0, file.length - '.sql'.length);
      const alreadyApplied = await migrationPool.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [version],
      );
      if (alreadyApplied.rowCount) continue;

      const sql = await readFile(join(migrationDirectory, file), 'utf8');
      try {
        await withTransaction(async client => {
          if (version === '002_unique_network_tx_hash') {
            await applyUniqueNetworkTxHashMigration(client);
          } else {
            await client.query(sql);
          }
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        });
      } catch (error) {
        if (error instanceof DuplicateTransactionHashesError) {
          console.error('Migration 002 aborted: duplicate network/transaction hashes require resolution:');
          console.error(JSON.stringify(error.duplicates, null, 2));
        }
        throw error;
      }
      console.log(`Applied migration ${version}.`);
    }
  } finally {
    await migrationPool.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrate()
    .catch(error => {
      console.error('Database migration failed:', error);
      process.exitCode = 1;
    });
}
