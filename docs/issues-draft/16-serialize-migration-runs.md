# Serialize Concurrent Migration Runs

**Complexity:** medium

## Context

Two deployment runners can both observe an unapplied migration and attempt its DDL concurrently because the migration script acquires no database lock before reading or applying migration versions. Affected users: operators running migrations from CI/CD pipelines that may trigger multiple concurrent deployments. Current behavior: `scripts/migrate.ts` reads and applies migrations without any advisory lock; a concurrent run can apply the same migration twice. Expected behavior: the runner acquires a PostgreSQL advisory lock before reading/applying migration versions, releases it in `finally`, and handles duplicate-hash or SQL failure without leaving the lock held. Evidence: `scripts/migrate.ts` (the `migrate()` function's apply loop).

## Acceptance criteria

- A test runs two migration runners concurrently and asserts the second waits or exits with a clear safe status and that each migration is applied exactly once.
- A test forces a duplicate-hash or SQL failure and asserts the advisory lock is released (no row for the lock key in `pg_locks`) so a retry can succeed.
- A test asserts no advisory lock remains after the process exits and existing migrations stay idempotent.
- `npm test -- tests/seed-admin.test.ts` passes.

## Files to touch

- `scripts/migrate.ts`
- `tests/seed-admin.test.ts` (or a focused migration-runner test)
- `docs/deployment.md`

## Test expectations

- Run: `npm test -- tests/seed-admin.test.ts`
- Run: `npm run typecheck`
- Run: `npm run db:migrate` against an isolated test database only.

## Out of scope

Schema redesign, production migration execution, or a major database library change.

## Depends on

None
