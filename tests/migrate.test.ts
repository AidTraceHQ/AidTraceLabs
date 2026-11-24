import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrate, type MigrationClient, type MigrationPool } from '../scripts/migrate.js';

type LockState = { held: boolean; applied: string[] };

type FakeOptions = {
  failSql?: boolean;
  duplicateHash?: boolean;
  events?: string[];
};

function createMigrationPool(state: LockState, options: FakeOptions = {}): MigrationPool {
  const events = options.events ?? [];
  const query = async (text: string, values?: unknown[]) => {
    const sql = text.replace(/\s+/g, ' ').trim();
    events.push(sql);

    if (sql.startsWith('SELECT pg_try_advisory_lock')) {
      if (state.held) return { rowCount: 1, rows: [{ locked: false }] };
      state.held = true;
      return { rowCount: 1, rows: [{ locked: true }] };
    }
    if (sql.startsWith('SELECT pg_advisory_unlock')) {
      state.held = false;
      return { rowCount: 1, rows: [{ pg_advisory_unlock: true }] };
    }
    if (sql.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations')) {
      return { rowCount: null, rows: [] };
    }
    if (sql.startsWith('SELECT 1 FROM schema_migrations')) {
      return { rowCount: state.applied.includes(String(values?.[0])) ? 1 : 0, rows: [] };
    }
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rowCount: 0, rows: [] };
    }
    if (sql.startsWith('SELECT id, network, tx_hash')) {
      return options.duplicateHash
        ? {
            rowCount: 1,
            rows: [
              {
                id: 'record-1',
                network: 'testnet',
                tx_hash: 'a'.repeat(64),
                duplicate_count: '2',
              },
            ],
          }
        : { rowCount: 0, rows: [] };
    }
    if (sql.startsWith('INSERT INTO schema_migrations')) {
      state.applied.push(String(values?.[0]));
      return { rowCount: 1, rows: [] };
    }
    if (options.failSql) {
      throw new Error('syntax error in test migration');
    }
    return { rowCount: 0, rows: [] };
  };

  return {
    connect: async () =>
      ({
        query: query as MigrationClient['query'],
        release: vi.fn(),
      }) satisfies MigrationClient,
    end: async () => undefined,
  };
}

async function createMigrationDirectory(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'aidtrace-migrations-'));
  for (const [name, sql] of Object.entries(files)) {
    await writeFile(join(directory, name), sql);
  }
  return directory;
}

const directories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('migration advisory lock', () => {
  it('lets only one concurrent runner apply a migration', async () => {
    const directory = await createMigrationDirectory({
      '001_test_table.sql': 'CREATE TABLE test_table (id TEXT)',
    });
    directories.push(directory);
    const state: LockState = { held: false, applied: [] };

    const runs = await Promise.all([
      migrate({
        createPool: () => createMigrationPool(state),
        migrationDirectory: directory,
      }),
      migrate({
        createPool: () => createMigrationPool(state),
        migrationDirectory: directory,
      }),
    ]);

    expect(runs.filter((run) => run.status === 'completed')).toHaveLength(1);
    expect(runs.filter((run) => run.status === 'locked')).toHaveLength(1);
    expect(state.applied).toEqual(['001_test_table']);
    expect(state.held).toBe(false);
  });

  it('releases the lock when a migration SQL statement fails', async () => {
    const directory = await createMigrationDirectory({
      '001_broken.sql': 'CREATE TABLE broken (',
    });
    directories.push(directory);
    const state: LockState = { held: false, applied: [] };
    const events: string[] = [];
    const release = vi.fn();
    const pool: MigrationPool = {
      connect: async () => ({
        query: (async (text: string, _values?: unknown[]) => {
          events.push(text.replace(/\s+/g, ' ').trim());
          if (text.startsWith('SELECT pg_try_advisory_lock')) {
            state.held = true;
            return { rowCount: 1, rows: [{ locked: true }] };
          }
          if (text.startsWith('SELECT pg_advisory_unlock')) {
            state.held = false;
            return { rowCount: 1, rows: [{ pg_advisory_unlock: true }] };
          }
          if (text.startsWith('SELECT 1 FROM schema_migrations')) {
            return { rowCount: 0, rows: [] };
          }
          if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
            return { rowCount: 0, rows: [] };
          }
          if (text.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations')) {
            return { rowCount: null, rows: [] };
          }
          if (text.startsWith('CREATE TABLE broken')) {
            throw new Error('syntax error in test migration');
          }
          return { rowCount: 1, rows: [] };
        }) as MigrationClient['query'],
        release,
      }),
      end: async () => undefined,
    };

    await expect(
      migrate({ createPool: () => pool, migrationDirectory: directory }),
    ).rejects.toThrow('syntax error in test migration');

    expect(state.held).toBe(false);
    expect(events.some((event) => event.startsWith('SELECT pg_advisory_unlock'))).toBe(true);
    expect(release).toHaveBeenCalledWith(false);
  });

  it('releases the lock after duplicate hashes abort migration 002', async () => {
    const directory = await createMigrationDirectory({
      '002_unique_network_tx_hash.sql': 'SELECT 1',
    });
    directories.push(directory);
    const state: LockState = { held: false, applied: [] };
    const events: string[] = [];
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      migrate({
        createPool: () => createMigrationPool(state, { duplicateHash: true, events }),
        migrationDirectory: directory,
      }),
    ).rejects.toMatchObject({ name: 'DuplicateTransactionHashesError' });

    expect(state.held).toBe(false);
    expect(state.applied).toEqual([]);
    expect(events).toContain('SELECT pg_advisory_unlock($1::bigint)');
  });

  it('skips already applied migrations and leaves no lock held', async () => {
    const directory = await createMigrationDirectory({
      '001_test_table.sql': 'CREATE TABLE test_table (id TEXT)',
    });
    directories.push(directory);
    const state: LockState = { held: false, applied: ['001_test_table'] };
    const events: string[] = [];

    const run = await migrate({
      createPool: () => createMigrationPool(state, { events }),
      migrationDirectory: directory,
    });

    expect(run).toEqual({ status: 'completed', applied: [] });
    expect(state.held).toBe(false);
    expect(events.some((event) => event.startsWith('BEGIN'))).toBe(false);
    expect(events).toContain('SELECT pg_advisory_unlock($1::bigint)');
import type { Pool, PoolConfig } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { createMigrationPool, MIGRATION_TIMEOUT_MS } from '../scripts/migrate.js';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool, type PoolConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createMigrationPool,
  MigrationChecksumError,
  migrationChecksum,
  MIGRATION_TIMEOUT_MS,
  runMigrations,
} from '../scripts/migrate.js';

function expectPositiveInteger(value: unknown): void {
  expect(Number.isInteger(value)).toBe(true);
  expect(value as number).toBeGreaterThan(0);
}

describe('migration pool timeouts', () => {
  it('uses a finite positive timeout constant', () => {
    expectPositiveInteger(MIGRATION_TIMEOUT_MS);
  });

  it('passes connection, query, and statement timeouts to the pool factory', () => {
    let captured: PoolConfig | undefined;
    const factory = vi.fn((config: PoolConfig): Pool => {
      captured = config;
      return { end: vi.fn() } as unknown as Pool;
    });

    createMigrationPool('postgresql://localhost:5432/aidtrace_test', factory);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(captured).toBeDefined();
    expect(captured!.connectionString).toBe('postgresql://localhost:5432/aidtrace_test');
    expectPositiveInteger(captured!.connectionTimeoutMillis);
    expectPositiveInteger(captured!.query_timeout);
    expectPositiveInteger(captured!.statement_timeout);
  });
});

const integration = describe.skipIf(!process.env.TEST_DATABASE_URL);

integration('migration checksums', () => {
  const schema = 'aidtrace_migration_test_' + randomBytes(6).toString('hex');
  const connectionString = process.env.TEST_DATABASE_URL_UNPOOLED;
  let pool: Pool;
  let maintenance: Pool;

  beforeAll(async () => {
    maintenance = new Pool({ connectionString });
    await maintenance.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({
      connectionString,
      options: `-c search_path=${schema}`,
      max: 1,
    });
  });

  afterAll(async () => {
    await pool?.end();
    await maintenance.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await maintenance.end();
  });

  async function withMigrationDirectory<T>(
    files: Record<string, string>,
    run: (directory: string) => Promise<T>,
  ): Promise<T> {
    const directory = await mkdtemp(join(tmpdir(), 'aidtrace-migrations-'));
    try {
      for (const [name, sql] of Object.entries(files)) {
        await writeFile(join(directory, name), sql, 'utf8');
      }
      return await run(directory);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  async function storedChecksum(version: string): Promise<string | null> {
    const result = await pool.query<{ checksum: string | null }>(
      'SELECT checksum FROM schema_migrations WHERE version = $1',
      [version],
    );
    return result.rows[0]?.checksum ?? null;
  }

  it('stores the SHA-256 checksum for a newly applied migration', async () => {
    const version = '911_checksum_probe';
    const file = version + '.sql';
    const sql = 'CREATE TABLE checksum_probe_911 (id INT);\n';

    await withMigrationDirectory({ [file]: sql }, async (directory) => {
      expect(await runMigrations(pool, { migrationDirectory: directory })).toEqual([version]);
      const contents = await readFile(join(directory, file), 'utf8');
      expect(await storedChecksum(version)).toBe(
        createHash('sha256').update(contents, 'utf8').digest('hex'),
      );
      expect(await storedChecksum(version)).toBe(migrationChecksum(contents));
    });
  });

  it('fails closed when an already-checksummed migration file changes', async () => {
    const version = '921_checksum_probe';
    const file = version + '.sql';
    const original = 'CREATE TABLE checksum_probe_921 (id INT);\n';
    const modified = 'CREATE TABLE checksum_probe_921 (id INT, changed TEXT);\n';
    const laterVersion = '922_checksum_probe_later';

    await withMigrationDirectory({ [file]: original }, async (directory) => {
      expect(await runMigrations(pool, { migrationDirectory: directory })).toEqual([version]);

      await writeFile(join(directory, file), modified, 'utf8');
      await writeFile(
        join(directory, laterVersion + '.sql'),
        'CREATE TABLE checksum_probe_later_922 (id INT);\n',
        'utf8',
      );

      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const error = await runMigrations(pool, { migrationDirectory: directory }).catch(
          (thrown: unknown) => thrown,
        );
        expect(error).toBeInstanceOf(MigrationChecksumError);
        expect((error as Error).message).toMatch(/changed after it was applied/);
        expect((error as Error).message).not.toContain('CREATE TABLE');
        const logged = [...log.mock.calls, ...errorLog.mock.calls].flat().join(' ');
        expect(logged).not.toContain('CREATE TABLE');
        expect(logged).not.toContain('changed TEXT');
      } finally {
        log.mockRestore();
        errorLog.mockRestore();
      }

      const later = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [
        laterVersion,
      ]);
      expect(later.rowCount).toBe(0);
      const marker = await pool.query<{ reg: string | null }>(
        "SELECT to_regclass('checksum_probe_later_922') AS reg",
      );
      expect(marker.rows[0].reg).toBeNull();
    });
  });

  it('is a no-op when migrations are unchanged', async () => {
    const version = '931_checksum_probe';
    const file = version + '.sql';

    await withMigrationDirectory(
      { [file]: 'CREATE TABLE checksum_probe_931 (id INT);\n' },
      async (directory) => {
        expect(await runMigrations(pool, { migrationDirectory: directory })).toEqual([version]);
        expect(await runMigrations(pool, { migrationDirectory: directory })).toEqual([]);
      },
    );
  });

  it('requires an explicit reviewed baseline for a null checksum', async () => {
    const version = '941_checksum_probe';
    const file = version + '.sql';
    const sql = 'CREATE TABLE checksum_probe_941 (id INT);\n';

    await withMigrationDirectory({ [file]: sql }, async (directory) => {
      expect(await runMigrations(pool, { migrationDirectory: directory })).toEqual([version]);
      await pool.query('UPDATE schema_migrations SET checksum = NULL WHERE version = $1', [
        version,
      ]);

      await expect(runMigrations(pool, { migrationDirectory: directory })).rejects.toThrow(
        /--baseline-checksums/,
      );
      expect(
        await runMigrations(pool, { migrationDirectory: directory, baselineChecksums: true }),
      ).toEqual([]);
      expect(await storedChecksum(version)).toBe(migrationChecksum(sql));
    });
  });
});
