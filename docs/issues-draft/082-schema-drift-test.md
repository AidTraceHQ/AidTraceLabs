# Add a schema drift test for the documented data model

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 8 hours

**Release day:** Day 1

## Problem statement

The applied schema comes from `migrations/001_initial_schema.sql` and `migrations/002_unique_network_tx_hash.sql`,
while `docs/backend-design.md:22-172` hand-maintains a full description of every table, column, constraint,
and index. Nothing verifies that the two agree. A future migration can add, rename, or drop a column or index
while the documentation keeps describing the old shape, and no test will fail. The data model is asserted only
by ad-hoc integration tests, which do not cover the full schema surface. Affected: maintainers and reviewers
who rely on the documented data model being accurate.

## Technical implementation requirements

- Add a test that, when `TEST_DATABASE_URL` is set, applies the migrations and introspects the catalog
  (`information_schema`/`pg_catalog`) into a stable, deterministic contract: tables, columns with types,
  nullability, defaults, `CHECK` constraints, foreign keys, and indexes.
- Assert the introspected contract matches a committed expectation, and that every table/column/index listed
  in the `docs/backend-design.md` data-model section exists in the database (and that the documented tables
  are the tables present).
- Keep the test `describe.skipIf(!process.env.TEST_DATABASE_URL)` like the existing integration suite, so the
  default `npm test` remains database-free.
- Do not modify existing migrations, runtime code, or the docs data-model semantics here beyond correcting
  genuine drift found while writing the test.

## Files and areas to touch

- `tests/schema.test.ts` (new)
- `docs/backend-design.md`
- `package.json` only if a dedicated script is warranted

## Dependencies

- None. Complements the migration-checksum draft (which guards file edits) by guarding the live schema shape;
  it does not read checksums.

## Measurable acceptance criteria

- With a fresh migrated `TEST_DATABASE_URL`, `npm test -- tests/schema.test.ts` exits 0.
- A test that simulates dropping/renaming one documented column or index (or asserts against a mutated copy
  of the expected snapshot) fails with a message naming the missing table/column/index.
- With `TEST_DATABASE_URL` unset, `npm test -- tests/schema.test.ts` reports the suite skipped (0 failures),
  and `npm run typecheck` exits 0.

## Expected deliverables

- A schema-introspection contract test, a committed expected snapshot, and any corrections to the
  `docs/backend-design.md` data-model section uncovered while writing it.

## How to set up and run tests

- Apply migrations and run `npm test -- tests/schema.test.ts` against the disposable `TEST_DATABASE_URL`
  described in `CONTRIBUTING.md`; confirm the file is skipped with the variable unset.
- Run `npm run typecheck`.

## Out of scope

- Migration checksums, concurrency locking, runtime schema-version checks, or changing the schema itself.

## Suggested labels

- `area: data`, `area: infrastructure`, `type: enhancement`, `difficulty: medium`
