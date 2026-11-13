# Separate Runtime and Migration Database Roles

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 10 hours

**Release day:** Day 1

## Problem statement

The runtime pool uses `DATABASE_URL`; migrations use `DATABASE_URL_UNPOOLED` or fall back to the runtime URL. The repository does not implement a least-privilege role split.

## Technical implementation requirements

- Define separate runtime, migration, and one-time bootstrap privileges appropriate to the schema.
- Make migration execution require its dedicated URL in production-like environments rather than silently falling back.
- Document safe local/test defaults and rotation.

## Files and areas to touch

- `server/environment.ts`
- `server/db.ts`
- `scripts/migrate.ts`
- `scripts/seed-admin.ts`
- `docs/deployment.md`
- `tests/environment.test.ts`

## Dependencies

- "Clean Up Expired Authentication and Rate-Limit Rows" cleanup command permissions should use the resulting role model.
- "Enforce Append-Only Audit Access" append-only audit controls depend on separating the runtime writer from the table owner.

## Measurable acceptance criteria

- A test or DDL check asserts the runtime credentials cannot run DDL (`CREATE TABLE` fails) and cannot update/delete audit rows outside the documented append path.
- A test asserts `npm run db:migrate` in production-like mode fails when its dedicated migration URL is missing, without falling back to the runtime URL.
- A test asserts a startup or migration failure message names the missing variable and never prints its value.
- `npm test -- tests/environment.test.ts tests/seed-admin.test.ts` passes.

## Expected deliverables

- Role/privilege plan, environment validation, migration wiring, and tests/docs.

## How to set up and run tests

- `npm test -- tests/environment.test.ts tests/seed-admin.test.ts`
- `npm run typecheck`

## Out of scope

- Changing record authorization or storing credentials in source control.

## Suggested labels

- `area: security`, `area: infrastructure`, `type: enhancement`, `difficulty: high`.
