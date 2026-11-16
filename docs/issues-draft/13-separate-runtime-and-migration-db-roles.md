# Separate Runtime and Migration Database Roles

**Complexity:** high

## Context

The runtime pool uses `DATABASE_URL`; migrations use `DATABASE_URL_UNPOOLED` or fall back to the runtime URL. No least-privilege role split is implemented. Affected users: operators running the API in production where the application credential has DDL and table-owner privileges it should not need. Current behavior: the runtime credential can run DDL and modify any table including the audit log. Expected behavior: distinct runtime, migration, and bootstrap credentials exist; a production migration run requires its dedicated URL and must not fall back to the runtime URL. Error messages must name missing variables without printing their values. Evidence: `server/environment.ts` (credential resolution), `server/db.ts` (pool construction), `scripts/migrate.ts` (migration runner), and `scripts/seed-admin.ts` (bootstrap).

## Acceptance criteria

- A test or DDL check asserts the runtime credentials cannot run DDL (`CREATE TABLE` fails) and cannot update or delete audit rows outside the documented append path.
- A test asserts `npm run db:migrate` in production-like mode fails when its dedicated migration URL is missing, without falling back to the runtime URL.
- A test asserts a startup or migration failure message names the missing variable and never prints its value.
- `npm test -- tests/environment.test.ts tests/seed-admin.test.ts` passes.

## Files to touch

- `server/environment.ts`
- `server/db.ts`
- `scripts/migrate.ts`
- `scripts/seed-admin.ts`
- `docs/deployment.md`
- `tests/environment.test.ts`

## Test expectations

- Run: `npm test -- tests/environment.test.ts tests/seed-admin.test.ts`
- Run: `npm run typecheck`
- Requires `TEST_DATABASE_URL` and `TEST_DATABASE_BRANCH=test` for the DDL and privilege checks.

## Out of scope

Changing record authorization or storing credentials in source control.

## Depends on

None
