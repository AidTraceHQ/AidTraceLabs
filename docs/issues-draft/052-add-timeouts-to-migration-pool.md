# Add Timeouts to the Migration Pool

**Complexity:** medium

## Context

The migration runner in `scripts/migrate.ts` creates its pool with only a connection string (line 12, the `migrationPool = new Pool({ connectionString: migrationUrl })` construction) and sets no `connectionTimeoutMillis`, `query_timeout`, or `statement_timeout`. By contrast, the runtime pool bounds these values in `server/db.ts` (lines 14–22, the exported `pool`) and the seed pool does the same in `scripts/seed-admin.ts` (the `createPool({ ... })` call at lines 33–38). A migration that waits on a lock or a stalled connection can hang `npm run db:migrate` indefinitely. Affected: operators running migrations.

## Acceptance criteria

- The migration pool is created with finite positive connection, query, and statement timeouts; a unit test injects a capturing factory and asserts the passed `PoolConfig` has `connectionTimeoutMillis`, `query_timeout`, and `statement_timeout` all set to positive integers.
- The existing migration tests (ordering, the duplicate-hash preflight in function `applyUniqueNetworkTxHashMigration`, version recording) pass unchanged.
- `npm test` and `npm run typecheck` pass.

## Files to touch

- `scripts/migrate.ts`
- `tests/backend.test.ts` or a new `tests/migrate.test.ts`

## Test expectations

- Run: `npm test -- tests/migrate.test.ts` (or `tests/backend.test.ts`) with `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty.
- Run: `npm run typecheck`

## Out of scope

Advisory locking, checksum recording, transactional DDL strategy, or changing migration files.

## Depends on

None
