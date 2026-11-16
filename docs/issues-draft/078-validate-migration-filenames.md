# Reject Unrecognized and Non-Sequential Migration Files

**Complexity:** medium

## Context

The `migrate()` runner in `scripts/migrate.ts` lists `migrations/`, keeps only files matching `/^\d{3}_[a-z0-9_]+\.sql$/`, and silently ignores everything else (the `readdir`+regex filter at lines 74–76). A file such as `003-add-index.sql` (hyphen), `003_Add_Index.sql` (uppercase), or `0003_x.sql` (four digits) is never applied but `npm run db:migrate` exits successfully with no warning. There is also no detection of numbering gaps or duplicate numeric prefixes, so an out-of-order or colliding migration can be applied in an unexpected order. Additionally, the runner hardcodes the `002` filename to run a duplicate-hash preflight (the `version === '002_unique_network_tx_hash'` branch at lines 89–90); renaming that file silently disables the safety check. Affected: operators running migrations who cannot tell a migration was skipped.

## Acceptance criteria

- With a misnamed file such as `003-add-index.sql` present, `npm run db:migrate` exits non-zero, prints the offending filename, and `schema_migrations` gains no new row.
- With duplicate prefixes (`003_a.sql` + `003_b.sql`) or a gap (`001_`, `003_`), the runner exits non-zero with a duplicate/gap message and applies no migration.
- `npm test -- tests/backend.test.ts` (or the new `tests/migrate.test.ts`) includes an assertion that the `002` duplicate-hash preflight (`applyUniqueNetworkTxHashMigration`) is still invoked for the registered `002` version, so renaming the file cannot silently skip it.
- `npm test` and `npm run typecheck` exit 0.

## Files to touch

- `scripts/migrate.ts`
- `tests/backend.test.ts` or a new `tests/migrate.test.ts`
- `docs/deployment.md`

## Test expectations

- Run with a disposable PostgreSQL test database (see `CONTRIBUTING.md`).
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Checksum recording, concurrency locking, pool timeouts, or editing historical migration SQL.

## Depends on

None
