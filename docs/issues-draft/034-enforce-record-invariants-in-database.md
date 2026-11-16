# Enforce Hash and Asset-Issuer Invariants in PostgreSQL

**Complexity:** medium

## Context

The API validates 64-hex transaction hashes and the XLM/non-native issuer relationship in `validHash`/`validAddress` used by `validateRecord` in `server/records.ts` (function `validateRecord`, lines 133–157), but the `aid_records` table stores unconstrained `tx_hash`, `asset_code`, and `asset_issuer` text in `migrations/001_initial_schema.sql` (lines 47–68). Direct SQL imports or future write paths can persist invalid combinations that the application cannot verify consistently. Affected users: administrators and auditors relying on the invariant that all stored records are valid. Current behavior: schema constraints do not enforce these invariants; invalid data can be inserted directly. Expected behavior: a forward-only migration adds constraints for lowercase 64-hex hashes and the XLM/issuer relationship; a preflight reports counts of invalid rows without silently rewriting or deleting them.

## Acceptance criteria

- On a fresh schema, `npm run db:migrate` then inserting a valid native row (`asset_code='XLM'`, `asset_issuer IS NULL`) and a valid issued-asset row (G-address issuer) succeeds; inserting a non-64-hex/lowercase-violating `tx_hash` or `asset_code='XLM'` with a non-null issuer fails with a constraint violation.
- A preflight test seeds invalid rows and asserts the migration fails and reports counts/categories only (no recipient names or full hashes) with unchanged row counts.
- The existing duplicate network/hash behavior is unchanged: the existing duplicate-hash migration test in `tests/backend.test.ts` still passes.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.

## Files to touch

- `migrations/003_record_integrity_constraints.sql` (or next free migration number)
- `scripts/migrate.ts` (only if preflight support is needed)
- `tests/backend.test.ts`
- `docs/deployment.md`

## Test expectations

- Use only the dedicated disposable `TEST_DATABASE_URL` described in `CONTRIBUTING.md`.
- Run: `npm run db:migrate` and `npm test -- tests/backend.test.ts` against the isolated test branch.
- Run: `npm run typecheck`

## Out of scope

Changing the record API contract, Stellar verification comparisons, or cleaning live data automatically.

## Depends on

None
