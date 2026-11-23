import type { Pool, PoolConfig } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { createMigrationPool, MIGRATION_TIMEOUT_MS } from '../scripts/migrate.js';

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
