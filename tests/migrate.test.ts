import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyMigration,
  discoverMigrations,
  migrate,
  MigrationSequenceError,
} from '../scripts/migrate.js';

const migrationsSource = fileURLToPath(new URL('../migrations/', import.meta.url));
const temporaryDirectories: string[] = [];

async function createMigrationDirectory(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'aidtrace-migrations-'));
  temporaryDirectories.push(directory);
  for (const [fileName, sql] of Object.entries(files)) {
    await writeFile(join(directory, fileName), sql);
  }
  return directory;
}

// Stands in for a pool client; records each statement so the caller can assert what ran.
function recordingClient() {
  const queries: string[] = [];
  const client = {
    query: vi.fn(async (sql: string) => {
      queries.push(sql);
      return { rowCount: 0, rows: [] };
    }),
  };
  return { client: client as unknown as Pick<PoolClient, 'query'>, queries };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('migration file discovery', () => {
  it('keeps the repository migrations sequential and uniquely numbered', async () => {
    const migrations = await discoverMigrations();
    expect(migrations.map((migration) => migration.number)).toEqual(
      Array.from({ length: migrations.length }, (_, index) => index + 1),
    );
    expect(new Set(migrations.map((migration) => migration.version)).size).toBe(migrations.length);
  });

  it.each([
    '003-add-index.sql',
    '003_Add_Index.sql',
    '0003_four_digit_prefix.sql',
    '3_short_prefix.sql',
  ])('rejects the unrecognized migration name %s instead of ignoring it', async (fileName) => {
    const directory = await createMigrationDirectory({
      '001_initial_schema.sql': 'SELECT 1;',
      '002_second.sql': 'SELECT 2;',
      [fileName]: 'SELECT 3;',
    });
    await expect(discoverMigrations(directory)).rejects.toBeInstanceOf(MigrationSequenceError);
    await expect(discoverMigrations(directory)).rejects.toThrow(fileName);
  });

  it('rejects duplicate migration numbers and names every colliding file', async () => {
    const directory = await createMigrationDirectory({
      '001_initial_schema.sql': 'SELECT 1;',
      '002_first.sql': 'SELECT 2;',
      '002_second.sql': 'SELECT 3;',
    });
    await expect(discoverMigrations(directory)).rejects.toThrow(
      /Duplicate migration number\(s\): 002 used by 002_first\.sql, 002_second\.sql/,
    );
  });

  it('rejects a numbering gap and names the migration that follows it', async () => {
    const directory = await createMigrationDirectory({
      '001_initial_schema.sql': 'SELECT 1;',
      '003_third.sql': 'SELECT 3;',
    });
    await expect(discoverMigrations(directory)).rejects.toThrow(
      /expected 002_\*\.sql before 003_third\.sql/,
    );
  });

  it('rejects an invalid migration sequence before touching the database', async () => {
    const directory = await createMigrationDirectory({
      '001_initial_schema.sql': 'SELECT 1;',
      '002-add-index.sql': 'CREATE INDEX unused ON records (id);',
    });
    await expect(migrate({ directory })).rejects.toThrow('002-add-index.sql');
  });
});

describe('migration execution', () => {
  it('runs the duplicate-hash preflight for the registered 002 migration', async () => {
    const migrations = await discoverMigrations();
    const registered = migrations.find((migration) => migration.number === 2);
    expect(registered).toBeDefined();
    expect(registered?.version.startsWith('002_')).toBe(true);

    const { client, queries } = recordingClient();
    await applyMigration(client, registered!);

    expect(queries[0]).toContain('duplicate_count');
    expect(queries[1]).toContain('aid_records_network_tx_hash_unique');
  });

  it('runs the duplicate-hash preflight even when the 002 migration is renamed', async () => {
    const directory = await createMigrationDirectory({
      '001_initial_schema.sql': 'SELECT 1;',
      '002_renamed_duplicate_hash_guard.sql': 'SELECT 2;',
    });
    const migrations = await discoverMigrations(directory);
    const renamed = migrations.find((migration) => migration.number === 2);
    expect(renamed?.version).toBe('002_renamed_duplicate_hash_guard');

    const { client, queries } = recordingClient();
    await applyMigration(client, renamed!);

    expect(queries[0]).toContain('duplicate_count');
    expect(queries[1]).toBe('SELECT 2;');
  });
});

const integration = describe.skipIf(!process.env.TEST_DATABASE_URL);

integration('migration runner with a database', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  afterAll(async () => {
    await pool.end();
  });

  it('applies and records nothing when a migration is misnamed', async () => {
    const migrations = await discoverMigrations();
    const nextNumber = String(migrations.length + 1).padStart(3, '0');
    const probeVersion = `${nextNumber}_probe_unapplied`;
    const offEndingFile = `${nextNumber}-add-index.sql`;

    const directory = await createMigrationDirectory({});
    await cp(migrationsSource, directory, { recursive: true });
    await writeFile(
      join(directory, `${probeVersion}.sql`),
      'CREATE TABLE migration_probe (id TEXT PRIMARY KEY);',
    );
    await writeFile(join(directory, offEndingFile), 'SELECT 1;');

    await expect(migrate({ directory })).rejects.toThrow(offEndingFile);

    const recorded = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [
      probeVersion,
    ]);
    expect(recorded.rowCount).toBe(0);

    const probeTable = await pool.query<{ table: string | null }>(
      "SELECT to_regclass('public.migration_probe')::text AS table",
    );
    expect(probeTable.rows[0]?.table).toBeNull();
  });
});
