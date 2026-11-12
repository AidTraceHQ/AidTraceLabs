# Separate Runtime and Migration Database Roles

**Publish:** Day 1

**Size:** High

## Problem statement

The runtime pool uses `DATABASE_URL`; migrations use `DATABASE_URL_UNPOOLED` or fall back to the runtime URL. The repository does not implement a least-privilege role split.

## Technical requirements

- Define separate runtime, migration, and one-time bootstrap privileges appropriate to the schema.
- Make migration execution require its dedicated URL in production-like environments rather than silently falling back.
- Document safe local/test defaults and rotation.

## Files to touch

- `server/environment.ts`
- `server/db.ts`
- `scripts/migrate.ts`
- `scripts/seed-admin.ts`
- `docs/deployment.md`
- `tests/environment.test.ts`

## Dependencies on other issues

- #10 cleanup command permissions should use the resulting role model.
- #24 append-only audit controls depend on separating the runtime writer from the table owner.

## Acceptance criteria

- Runtime credentials cannot run DDL or mutate audit rows outside the documented append path.
- Migration credentials can apply migrations but are not used by request handlers.
- Startup and migration failures name the missing variable, never its value.

## Deliverables

- Role/privilege plan, environment validation, migration wiring, and tests/docs.

## How to run tests

- `npm test -- tests/environment.test.ts tests/seed-admin.test.ts`
- `npm run typecheck`

## Out of scope

- Changing record authorization or storing credentials in source control.

## Suggested labels

- `area: security`, `area: infrastructure`, `type: enhancement`, `difficulty: high`.
