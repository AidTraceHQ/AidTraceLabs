# Require Explicit Target Confirmation for Admin Seeding

**Complexity:** intermediate

## Context

The admin seed script validates the wallet and presence of `DATABASE_URL`, then writes the role without identifying or confirming the target database branch. An operator who misconfigures the environment can silently seed a wrong database. Affected users: operators running the bootstrap for the first time, and maintainers performing administrative recovery. Current behavior: `scripts/seed-admin.ts` writes after validating only that a wallet and URL are present; it does not print the target label or require confirmation. Expected behavior: a non-secret target environment/branch confirmation is required for production-like seeding; output contains only the target label and wallet suffix Ã¢â‚¬â€ never a connection string or full address. Evidence: `scripts/seed-admin.ts` and `docs/deployment.md` (bootstrap procedure).

## Acceptance criteria

- `tests/seed-admin.test.ts` asserts a run with a missing or mismatched target confirmation exits non-zero and performs no role write.
- A test asserts the confirmed dev/test/demo and documented production bootstrap paths each write exactly one role.
- A test asserts the output contains only the target label and wallet suffix and never the connection string or full address.
- `npm test -- tests/seed-admin.test.ts` passes.

## Files to touch

- `scripts/seed-admin.ts`
- `scripts/seed-admin.test.ts`
- `docs/deployment.md`

## Test expectations

- Run: `npm test -- tests/seed-admin.test.ts`
- Run: `npm run typecheck`
- No live database required for the guard and output tests.

## Out of scope

A public admin bootstrap endpoint or changes to wallet authentication.

## Depends on

Separate Runtime and Migration Database Roles
