# Add a Database Readiness Probe

**Complexity:** medium

## Context

`/api/_healthcheck` reports process liveness even when PostgreSQL is unavailable, so an orchestrator cannot distinguish a running process from a ready API. Affected users: operators using health checks to route traffic or gate deployments. Current behavior: `GET /api/_healthcheck` returns `{ ok: true }` regardless of database connectivity. Expected behavior: a separate readiness route performs a bounded `SELECT 1` and returns a non-200 status when the database is unavailable, without exposing connection details. The existing liveness route must continue to return success independently. Evidence: `server/app.ts` (health check handler at the `app.get('/api/_healthcheck', …)` route).

## Acceptance criteria

- With a mocked successful `SELECT 1`, the readiness route returns `200`.
- With a mocked failing or timing-out database, the readiness route returns a non-200 status (e.g. `503`) whose body contains no credentials, host, or connection string.
- With the database check failing, `GET /api/_healthcheck` still returns success, proving liveness is independent of readiness.
- `npm test -- tests/backend.test.ts tests/database-errors.test.ts` passes.

## Files to touch

- `server/app.ts`
- `server/database-errors.ts`
- `tests/backend.test.ts`
- `docs/deployment.md`

## Test expectations

- Run: `npm test -- tests/backend.test.ts tests/database-errors.test.ts`
- Run: `npm run typecheck`
- No live database required for mocked success/failure cases.

## Out of scope

Changing Vercel deployment behavior or replacing the existing liveness endpoint.

## Depends on

None
