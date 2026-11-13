# Add a Database Readiness Probe

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 1

## Problem statement

`/api/_healthcheck` reports process liveness even when PostgreSQL is unavailable, so an orchestrator cannot distinguish a running process from a ready API.

## Technical implementation requirements

- Preserve the existing liveness route and add a separate readiness check with a bounded `SELECT 1`.
- Return a non-sensitive unavailable response and avoid leaking connection details.

## Files and areas to touch

- `server/app.ts`
- `server/database-errors.ts`
- `tests/backend.test.ts`
- `docs/deployment.md`

## Dependencies

- None.

## Measurable acceptance criteria

- With a mocked successful `SELECT 1`, the readiness route returns `200`.
- With a mocked failing or timing-out database, the readiness route returns a non-200 status (e.g. `503`) whose body contains no credentials, host, or connection string.
- With the database check failing, `/api/_healthcheck` still returns success, proving liveness is independent of readiness.
- `npm test -- tests/backend.test.ts tests/database-errors.test.ts` passes.

## Expected deliverables

- Readiness route, mocked DB success/failure tests, and deployment documentation.

## How to set up and run tests

- `npm test -- tests/backend.test.ts tests/database-errors.test.ts`
- `npm run typecheck`

## Out of scope

- Changing Vercel deployment behavior or replacing the existing liveness endpoint.

## Suggested labels

- `area: backend`, `area: infrastructure`, `type: enhancement`, `difficulty: medium`.
