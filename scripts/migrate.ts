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
  await client.query(
    await readFile(join(migrationDirectory, '002_unique_network_tx_hash.sql'), 'utf8'),
  );
}

// Each category is the negation of one rule in 003_record_integrity_constraints.sql. A row
// can fall into more than one category. Only counts leave this query, never row contents.
const recordIntegrityChecks = {
  tx_hash_not_lowercase: `tx_hash IS NOT NULL AND tx_hash ~ '^[0-9a-fA-F]{64}$' AND tx_hash !~ '^[0-9a-f]{64}$'`,
  tx_hash_malformed: `tx_hash IS NOT NULL AND tx_hash !~ '^[0-9a-fA-F]{64}$'`,
  asset_code_malformed: `asset_code !~ '^[A-Z0-9]{1,12}$'`,
  native_asset_with_issuer: `asset_code = 'XLM' AND asset_issuer IS NOT NULL`,
  issued_asset_missing_issuer: `asset_code <> 'XLM' AND asset_issuer IS NULL`,
  issued_asset_invalid_issuer: `asset_code <> 'XLM' AND asset_issuer !~ '^G[A-Z2-7]{55}$'`,
} as const;

export type RecordIntegrityCategory = keyof typeof recordIntegrityChecks;
export type RecordIntegrityViolation = { category: RecordIntegrityCategory; count: number };

export class InvalidAidRecordsError extends Error {
  constructor(readonly violations: RecordIntegrityViolation[]) {
    super(
      'Migration 003 aborted: fix the aid_records rows in these categories, then re-run npm run db:migrate: ' +
        violations.map(({ category, count }) => `${category}=${count}`).join(', ') +
        '.',
    );
    this.name = 'InvalidAidRecordsError';
  }
}

export async function applyRecordIntegrityConstraintsMigration(
  client: Pick<import('pg').PoolClient, 'query'>,
) {
  // Block writes until the constraints exist so the counts below stay accurate.
  await client.query('LOCK TABLE aid_records IN SHARE ROW EXCLUSIVE MODE');
  const counts = await client.query<Record<RecordIntegrityCategory, string>>(
    `SELECT ${Object.entries(recordIntegrityChecks)
      .map(([category, condition]) => `COUNT(*) FILTER (WHERE ${condition})::text AS ${category}`)
      .join(', ')}
     FROM aid_records`,
  );
  const row = counts.rows[0];
  const violations = (Object.keys(recordIntegrityChecks) as RecordIntegrityCategory[])
    .map((category) => ({ category, count: Number(row?.[category] ?? 0) }))
    .filter(({ count }) => count > 0);
  if (violations.length) {
    throw new InvalidAidRecordsError(violations);
  }
  await client.query(
    await readFile(join(migrationDirectory, '003_record_integrity_constraints.sql'), 'utf8'),
  );
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
      .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/.test(file))
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
        await withTransaction(async (client) => {
          if (version === '002_unique_network_tx_hash') {
            await applyUniqueNetworkTxHashMigration(client);
          } else if (version === '003_record_integrity_constraints') {
            await applyRecordIntegrityConstraintsMigration(client);
          } else {
            await client.query(sql);
          }
          await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        });
      } catch (error) {
        if (error instanceof DuplicateTransactionHashesError) {
          console.error(
            'Migration 002 aborted: duplicate network/transaction hashes require resolution:',
          );
          console.error(JSON.stringify(error.duplicates, null, 2));
        } else if (error instanceof InvalidAidRecordsError) {
          console.error(
            'Migration 003 aborted: aid_records rows violate the new rules (counts only):',
          );
          console.error(JSON.stringify(error.violations, null, 2));
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
  migrate().catch((error) => {
    console.error('Database migration failed:', error);
    process.exitCode = 1;
  });
}
