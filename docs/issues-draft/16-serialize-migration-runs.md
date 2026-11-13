# Serialize Concurrent Migration Runs

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 3

## Problem statement

Two deployment runners can both observe an unapplied migration and attempt its DDL concurrently because the migration script has no database lock.

## Technical implementation requirements

- Acquire a PostgreSQL advisory lock before reading/applying migration versions.
- Release it in `finally`, including on duplicate-hash or SQL failure.
- Keep each migration transaction and existing migration ordering intact.

## Files and areas to touch

- `scripts/migrate.ts`
- `tests/seed-admin.test.ts` or a focused migration-runner test
- `docs/deployment.md`

## Dependencies

- None.

## Measurable acceptance criteria

- A test runs two migration runners concurrently and asserts the second waits or exits with a clear safe status and that each migration is applied exactly once.
- A test forces a duplicate-hash or SQL failure and asserts the advisory lock is released (no row for the lock key in `pg_locks`) so a retry can succeed.
- A test asserts no advisory lock remains after the process exits and existing migrations stay idempotent.
- `npm test -- tests/seed-admin.test.ts` passes.

## Expected deliverables

- Migration lock lifecycle and concurrency/failure tests.

## How to set up and run tests

- `npm test -- tests/seed-admin.test.ts`
- `npm run typecheck`
- `npm run db:migrate` against an isolated test database only.

## Out of scope

- Schema redesign, production migration execution, or a major database library change.

## Suggested labels

- `area: infrastructure`, `area: backend`, `type: bug`, `difficulty: medium`.
