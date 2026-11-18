# Add a Schema Drift Test for the Documented Data Model

**Complexity:** intermediate

## Context

The applied schema comes from `migrations/001_initial_schema.sql` and `migrations/002_unique_network_tx_hash.sql`, while `docs/backend-design.md` (lines 22Ã¢â‚¬â€œ172) hand-maintains a full description of every table, column, constraint, and index. Nothing verifies that the two agree. A future migration can add, rename, or drop a column or index while the documentation keeps describing the old shape, and no test will fail. Affected: maintainers and reviewers who rely on the documented data model being accurate.

## Acceptance criteria

- With a fresh migrated `TEST_DATABASE_URL`, `npm test -- tests/schema.test.ts` exits 0.
- A test that simulates dropping or renaming one documented column or index fails with a message naming the missing table/column/index.
- With `TEST_DATABASE_URL` unset, `npm test -- tests/schema.test.ts` reports the suite skipped (0 failures).
- `npm run typecheck` exits 0.

## Files to touch

- `tests/schema.test.ts` (new)
- `docs/backend-design.md`
- `package.json` (only if a dedicated script is warranted)

## Test expectations

- Apply migrations and run: `npm test -- tests/schema.test.ts` against the disposable `TEST_DATABASE_URL` (see `CONTRIBUTING.md`).
- Confirm the file is skipped with the variable unset.
- Run: `npm run typecheck`

## Out of scope

Migration checksums, concurrency locking, runtime schema-version checks, or changing the schema itself.

## Depends on

None
