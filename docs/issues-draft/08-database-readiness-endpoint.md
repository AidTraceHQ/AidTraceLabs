# Add a Database Readiness Probe

**Publish:** Day 1

**Size:** Medium

## Problem statement

`/api/_healthcheck` reports process liveness even when PostgreSQL is unavailable, so an orchestrator cannot distinguish a running process from a ready API.

## Technical requirements

- Preserve the existing liveness route and add a separate readiness check with a bounded `SELECT 1`.
- Return a non-sensitive unavailable response and avoid leaking connection details.

## Files to touch

- `server/app.ts`
- `server/database-errors.ts`
- `tests/backend.test.ts`
- `docs/deployment.md`

## Dependencies on other issues

- None.

## Acceptance criteria

- Readiness returns success only when the database query succeeds within the timeout.
- Database failure returns a non-200 response without credentials or host details.
- Liveness remains independent of database readiness.

## Deliverables

- Readiness route, mocked DB success/failure tests, and deployment documentation.

## How to run tests

- `npm test -- tests/backend.test.ts tests/database-errors.test.ts`
- `npm run typecheck`

## Out of scope

- Changing Vercel deployment behavior or replacing the existing liveness endpoint.

## Suggested labels

- `area: backend`, `area: infrastructure`, `type: enhancement`, `difficulty: medium`.
