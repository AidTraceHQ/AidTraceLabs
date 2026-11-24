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
