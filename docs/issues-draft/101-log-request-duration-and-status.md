# Log Request Duration and Status for the API

**Complexity:** medium

## Context

The API emits no per-request log. The middleware chain in `server/app.ts` (lines 9–18, from `app.disable('x-powered-by')` through `app.use(recordsRouter)`) installs CORS, rate limits, body parsing, and the routers but no timing or access logging. The only request-derived log is the error logger, which prints only the raw error without method, path, or duration (line 47, the `console.error('Unhandled API error:', error)` call). Affected: maintainers diagnosing incidents and reliability work that has no latency signal to measure against. Must integrate with "Add Correlated, Redacted API Error Logs" if that has landed; otherwise be self-contained and forward-compatible.

## Acceptance criteria

- A unit test asserts one `GET /api/transparency` request emits exactly one completion line matching a regex with method, route, status `200`, and a numeric millisecond duration, while one `GET /api/_healthcheck` request emits none.
- The captured line contains none of the value of `SESSION_SECRET`, the `aidtrace_session` cookie value, the bound `signature`, or the value of `DATABASE_URL`.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` exit with code 0.

## Files to touch

- `server/app.ts`
- `tests/` (a unit test asserting the log line shape and that secrets are absent)

## Test expectations

- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`
- Manual: run `npm run dev`, issue requests to `/api/transparency` and `/api/auth/challenge`, and inspect the emitted lines.

## Out of scope

Adding a metrics backend, APM integration, log shipping, distributed tracing, and alerting.

## Depends on

Add Correlated, Redacted API Error Logs
