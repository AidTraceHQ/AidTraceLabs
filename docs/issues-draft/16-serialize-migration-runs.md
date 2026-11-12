# Serialize Concurrent Migration Runs

**Publish:** Day 3

**Size:** Medium

## Problem statement

Two deployment runners can both observe an unapplied migration and attempt its DDL concurrently because the migration script has no database lock.

## Technical requirements

- Acquire a PostgreSQL advisory lock before reading/applying migration versions.
- Release it in `finally`, including on duplicate-hash or SQL failure.
- Keep each migration transaction and existing migration ordering intact.

## Files to touch

- `scripts/migrate.ts`
- `tests/seed-admin.test.ts` or a focused migration-runner test
- `docs/deployment.md`

## Dependencies on other issues

- None.

## Acceptance criteria

- A second concurrent runner waits or exits with a clear safe status.
- A failed migration releases the lock and can be retried.
- Existing migrations remain idempotent and no lock persists after process exit.

## Deliverables

- Migration lock lifecycle and concurrency/failure tests.

## How to run tests

- `npm test -- tests/seed-admin.test.ts`
- `npm run typecheck`
- `npm run db:migrate` against an isolated test database only.

## Out of scope

- Schema redesign, production migration execution, or a major database library change.

## Suggested labels

- `area: infrastructure`, `area: backend`, `type: bug`, `difficulty: medium`.
