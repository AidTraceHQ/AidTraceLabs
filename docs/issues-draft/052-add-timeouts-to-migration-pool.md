# Add Timeouts to the Migration Pool

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 3

## Problem statement

The migration runner creates its pool with only a connection string (`scripts/migrate.ts:12`, the `migrationPool = new Pool({ connectionString: migrationUrl })` construction) and sets no `connectionTimeoutMillis`, `query_timeout`, or `statement_timeout`. By contrast, the runtime pool bounds connection, query, and statement time (`server/db.ts:14-22`, the exported `pool`) and the admin seed pool does the same (`scripts/seed-admin.ts:16`, the `connectionTimeoutMs` constant; `scripts/seed-admin.ts:33-38`, the `createPool({ ... })` call inside `seedAdmin`). A migration that waits on a lock, or a stalled connection, can therefore hang `npm run db:migrate` indefinitely with no diagnostic. Affected: operators running migrations.

## Technical implementation requirements

- Add `connectionTimeoutMillis`, `query_timeout`, and `statement_timeout` to the migration pool, either matching the seed values (`scripts/seed-admin.ts:33-38`) or documenting a deliberately larger `statement_timeout` for long DDL.
- Keep the migration ordering, the duplicate-hash preflight (`scripts/migrate.ts:43-63`, the `applyUniqueNetworkTxHashMigration` function), and `schema_migrations` behavior unchanged.
- To make the configuration testable, allow the pool to be created through an injectable factory, mirroring the approach already used in `seedAdmin` (`scripts/seed-admin.ts:18-38`, which takes a `createPool` parameter).
- Do NOT add advisory locking or serialization here (tracked separately).

## Files and areas to touch

- `scripts/migrate.ts`
- `tests/backend.test.ts` or a new `tests/migrate.test.ts`

## Dependencies

- None. Distinct from the migration-serialization and migration-checksum drafts.

## Measurable acceptance criteria

- The migration pool is created with finite positive connection, query, and statement timeouts; a unit test (for example in `tests/backend.test.ts` or a new `tests/migrate.test.ts`) injects a capturing factory and asserts the passed `PoolConfig` has `connectionTimeoutMillis`, `query_timeout`, and `statement_timeout` all set to positive integers.
- The existing migration tests (ordering, the duplicate-hash preflight in `applyUniqueNetworkTxHashMigration`, version recording) pass unchanged.
- `npm test` and `npm run typecheck` pass.

## Expected deliverables

- Migration-pool timeout configuration with a focused test.

## How to set up and run tests

- Configuration is asserted through an injected pool factory; run `npm test -- tests/migrate.test.ts` (or `tests/backend.test.ts`) with `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty.
- Run `npm run typecheck`.

## Out of scope

- Advisory locking, checksum recording, transactional DDL strategy, or changing migration files.

## Suggested labels

- `area: backend`, `type: enhancement`, `difficulty: medium`
