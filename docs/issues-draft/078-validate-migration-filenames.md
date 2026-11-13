# Reject unrecognized and non-sequential migration files

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 2

## Problem statement

The `migrate()` runner lists `migrations/`, keeps only files matching `/^\d{3}_[a-z0-9_]+\.sql$/`, and
silently ignores everything else (`scripts/migrate.ts:74-76`, the `readdir`+regex filter inside `migrate()`).
A file such as `003-add-index.sql` (hyphen), `003_Add_Index.sql` (uppercase), or `0003_x.sql` (four digits) is
therefore never applied, yet `npm run db:migrate` exits successfully and prints no warning. There is also no
detection of numbering gaps or duplicate numeric prefixes, so an out-of-order or colliding migration can be
applied in an unexpected order. Separately, the runner hardcodes the `002` filename to run its duplicate-hash
preflight (`scripts/migrate.ts:89-90`, the `version === '002_unique_network_tx_hash'` branch in `migrate()` that
calls `applyUniqueNetworkTxHashMigration`); renaming that file silently disables the safety check while still
applying the raw SQL. Affected: operators running migrations who cannot tell that a migration was skipped.

## Technical implementation requirements

- Before applying anything, enumerate every `*.sql` file directly under `migrations/` and fail closed
  (non-zero exit, no writes) if any file does not match the expected `\d{3}_[a-z0-9_]+\.sql` pattern;
  report the offending filenames only.
- Detect duplicate numeric prefixes and non-sequential ordering and fail closed with a clear message.
- Remove the filename hardcoding for the `002` preflight: associate the preflight with an explicit,
  documented rule (for example a small registry keyed by version) so renaming or reordering cannot
  silently bypass it. Keep the current preflight behaviour identical for `002`.
- Preserve ordered execution, per-migration transactions, `schema_migrations` recording, and idempotency.
- Do NOT add advisory locking (tracked separately) or checksums (tracked separately).

## Files and areas to touch

- `scripts/migrate.ts`
- `tests/backend.test.ts` or a new `tests/migrate.test.ts`
- `docs/deployment.md`

## Dependencies

- None. Distinct from the migration-lock and migration-checksum drafts; this is input validation and
  ordering, not concurrency or integrity hashing.

## Measurable acceptance criteria

- With a misnamed file such as `003-add-index.sql` (or `003_Add_Index.sql`) present, `npm run db:migrate`
  exits non-zero, prints the offending filename, and `schema_migrations` gains no new row.
- With duplicate prefixes (`003_a.sql` + `003_b.sql`) or a gap (`001_`, `003_`), the runner exits non-zero
  with a duplicate/gap message and applies no migration.
- `npm test -- tests/backend.test.ts` (or the new `tests/migrate.test.ts`) includes an assertion that the
  `002` duplicate-hash preflight (`applyUniqueNetworkTxHashMigration`) is still invoked for the registered
  `002` version, so renaming the file cannot silently skip it.
- `npm test` and `npm run typecheck` exit 0.

## Expected deliverables

- Migration-file validation plus ordering checks in the runner, a focused runner test, and a short note in
  `docs/deployment.md` describing the required filename convention.

## How to set up and run tests

- Run the focused runner tests with a disposable PostgreSQL test database (see `CONTRIBUTING.md`), for
  example `npm test -- tests/backend.test.ts`, then `npm run typecheck`.

## Out of scope

- Checksum recording, concurrency locking, pool timeouts, or editing historical migration SQL.

## Suggested labels

- `area: data`, `type: bug`, `difficulty: medium`
