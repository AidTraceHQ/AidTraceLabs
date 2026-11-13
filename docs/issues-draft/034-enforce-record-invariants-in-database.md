# Enforce Hash and Asset-Issuer Invariants in PostgreSQL

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 1

## Problem statement

The API validates 64-hex transaction hashes and the XLM/non-native issuer relationship in `validHash`/`validAddress`, used by `validateRecord` (`server/records.ts:133-157`), but the `aid_records` table stores unconstrained `tx_hash`, `asset_code`, and `asset_issuer` text (`migrations/001_initial_schema.sql:47-68`). Direct SQL imports or future write paths can persist invalid combinations that the application cannot verify consistently.

## Technical implementation requirements

- Add a forward-only migration with constraints for lowercase 64-hex hashes when non-null and `asset_code='XLM'` iff issuer is null; non-native assets require a valid issuer G-address format.
- Preflight existing rows and report counts/categories only; do not silently rewrite or delete records.
- If invalid rows exist, fail migration with a remediation report that omits recipient data and full hashes.
- Keep application validation and network/hash uniqueness behavior intact.

## Files and areas to touch

- `migrations/003_record_integrity_constraints.sql` (or next free migration number)
- `scripts/migrate.ts` only if preflight support is needed
- `tests/backend.test.ts`
- `docs/deployment.md`

## Dependencies

- None.

## Measurable acceptance criteria

- On a fresh schema, `npm run db:migrate` then inserting a valid native row (`asset_code='XLM'`, `asset_issuer IS NULL`) and a valid issued-asset row (G-address issuer) succeeds; inserting a non-64-hex/lowercase-violating `tx_hash` or `asset_code='XLM'` with a non-null issuer fails with a constraint violation.
- A preflight test seeds invalid rows and asserts the migration fails and reports counts/categories only (no recipient names or full hashes) with unchanged row counts.
- The duplicate network/hash behavior is unchanged: the existing duplicate-hash migration test in `tests/backend.test.ts` still passes.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.

## Expected deliverables

- Idempotent schema migration, preflight behavior, database-backed constraint tests, and remediation instructions.

## How to set up and run tests

- Use only the dedicated disposable `TEST_DATABASE_URL` described in `CONTRIBUTING.md`.
- Run `npm run db:migrate` and `npm test -- tests/backend.test.ts` against that isolated test branch, then `npm run typecheck`.

## Out of scope

- Changing the record API contract, Stellar verification comparisons, or cleaning live data automatically.

## Suggested labels

- `area: backend`, `area: security`, `type: enhancement`, `difficulty: medium`.
