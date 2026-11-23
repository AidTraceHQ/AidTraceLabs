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

const migrationFileNamePattern = /^(\d{3})_([a-z0-9_]+)\.sql$/;

// The duplicate-hash preflight belongs to the migration numbered 002, not to a particular file
// name, so renaming that file cannot silently disable the safety check.
const DUPLICATE_TX_HASH_PREFLIGHT_NUMBER = 2;

// Migrations renumbered when unique sequential numbering was enforced. A database migrated before
// the renumbering still records the old version names, so those migrations stay marked as applied.
const RENAMED_MIGRATION_VERSIONS: Record<string, string[]> = {
  '005_verification_memo': ['003_verification_memo'],
  '006_wallet_roles_updated_index': ['003_wallet_roles_updated_index'],
};

export type Migration = {
  version: string;
  number: number;
  fileName: string;
  path: string;
};

export class MigrationSequenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationSequenceError';
  }
}

export async function discoverMigrations(directory = migrationDirectory): Promise<Migration[]> {
  const fileNames = (await readdir(directory))
    .filter((fileName) => fileName.toLowerCase().endsWith('.sql'))
    .sort();

  const unrecognized = fileNames.filter((fileName) => !migrationFileNamePattern.test(fileName));
  if (unrecognized.length > 0) {
    throw new MigrationSequenceError(
      `Unrecognized migration file(s): ${unrecognized.join(', ')}. ` +
        'Migration files must be named NNN_lower_snake_case.sql: exactly three digits, an ' +
        'underscore, and a lowercase snake_case name.',
    );
  }

  const migrations = fileNames.map((fileName) => ({
    version: fileName.slice(0, -'.sql'.length),
    number: Number(migrationFileNamePattern.exec(fileName)![1]),
    fileName,
    path: join(directory, fileName),
  }));

  const fileNamesByNumber = new Map<number, string[]>();
  for (const migration of migrations) {
    const names = fileNamesByNumber.get(migration.number) ?? [];
    names.push(migration.fileName);
    fileNamesByNumber.set(migration.number, names);
  }
  const duplicates = [...fileNamesByNumber.entries()].filter(([, names]) => names.length > 1);
  if (duplicates.length > 0) {
    throw new MigrationSequenceError(
      `Duplicate migration number(s): ${duplicates
        .map(([number, names]) => `${String(number).padStart(3, '0')} used by ${names.join(', ')}`)
        .join('; ')}. Give each migration a unique number.`,
    );
  }

  for (const [index, migration] of migrations.entries()) {
    const expectedNumber = index + 1;
    if (migration.number !== expectedNumber) {
      throw new MigrationSequenceError(
        `Migration numbering gap: expected ${String(expectedNumber).padStart(3, '0')}_*.sql ` +
          `before ${migration.fileName}. Migrations must be numbered sequentially from 001.`,
      );
    }
  }

  return migrations;
}

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
  migrationPath?: string,
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
  let path = migrationPath;
  if (!path) {
    const migration = (await discoverMigrations()).find(
      (candidate) => candidate.number === DUPLICATE_TX_HASH_PREFLIGHT_NUMBER,
    );
    if (!migration) {
      throw new Error(
        `No migration is numbered ${String(DUPLICATE_TX_HASH_PREFLIGHT_NUMBER).padStart(3, '0')}; ` +
          'the duplicate-hash preflight cannot run.',
      );
    }
    path = migration.path;
  }
  await client.query(await readFile(path, 'utf8'));
}

export async function applyMigration(
  client: Pick<PoolClient, 'query'>,
  migration: Migration,
): Promise<void> {
  if (migration.number === DUPLICATE_TX_HASH_PREFLIGHT_NUMBER) {
    await applyUniqueNetworkTxHashMigration(client, migration.path);
    return;
  }
  await client.query(await readFile(migration.path, 'utf8'));
}

async function applyMigrations(migrations: Migration[]) {
  await migrationPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const migration of migrations) {
    const appliedVersions = [
      migration.version,
      ...(RENAMED_MIGRATION_VERSIONS[migration.version] ?? []),
    ];
    const alreadyApplied = await migrationPool.query(
      'SELECT 1 FROM schema_migrations WHERE version = ANY($1::text[])',
      [appliedVersions],
    );
    if (alreadyApplied.rowCount) continue;

    try {
      await withTransaction(async (client) => {
        await applyMigration(client, migration);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [
          migration.version,
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
  }
}

export async function migrate(options: { directory?: string } = {}) {
  // The whole directory is validated before the database is touched, so an invalid sequence
  // cannot apply a partial migration or record a version.
  const migrations = await discoverMigrations(options.directory);
  try {
    await applyMigrations(migrations);
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
