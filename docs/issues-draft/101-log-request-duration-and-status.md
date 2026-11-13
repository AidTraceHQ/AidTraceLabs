# Log request duration and status for the API

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 2

## Problem statement

The API emits no per-request log. The middleware chain installs CORS, rate limits, body parsing, and
the routers but no timing or access logging (`server/app.ts:9-18`, the `app` middleware chain from
`app.disable('x-powered-by')` through `app.use(recordsRouter)`), and the only request-derived log
is the error logger, which prints the error without the method, path, or duration
(`server/app.ts:47`, the `console.error('Unhandled API error:', error)` call in `errorHandler`).
Operators cannot see which endpoints are slow, how often a route returns `5xx`
vs `4xx`, or that `/api/transparency` degrades under load. Affected: maintainers diagnosing
incidents, and the reliability work tracked elsewhere that has no signal to measure against.

## Technical implementation requirements

- Add a middleware that records a start time and, on response `finish`, logs method, path (without
  query strings that may carry filters/secrets), status code, and duration in milliseconds.
- Log in a single structured line; do not print request bodies, headers, cookies, tokens, signatures,
  or the database URL.
- Skip or sample the high-frequency health check (`server/app.ts:20-22`, the
  `app.get('/api/_healthcheck', …)` handler) to avoid noise.
- Integrate with the request-correlation draft ("Add Correlated, Redacted API Error Logs") if it has landed: reuse the request id rather
  than adding a second identifier. If it has not landed, keep this middleware self-contained and
  forward-compatible.
- Do not change response behaviour, status codes, or timing.

## Files and areas to touch

- `server/app.ts`
- `tests/` (a unit test asserting the log line shape and that secrets are absent)

## Dependencies

- Complements "Add Correlated, Redacted API Error Logs" (correlated safe API logs). "Add Correlated, Redacted API Error Logs" adds correlation identity and safe fields; this adds
  timing and status. They must not duplicate each other's middleware.

## Measurable acceptance criteria

- A unit test in `tests/` (new file or `tests/backend.test.ts`) asserts that one
  `GET /api/transparency` request emits exactly one completion line matching a regex with method,
  route, status `200`, and a numeric millisecond duration, while one `GET /api/_healthcheck` request
  emits none.
- The same test asserts the captured line contains none of the value of `SESSION_SECRET`, the
  `aidtrace_session` cookie value, the bound `signature`, or the value of `DATABASE_URL`.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` exit with code 0.

## Expected deliverables

- A request-timing/status logging middleware, a unit test, and a short note in the backend design.

## How to set up and run tests

- Run `npm run dev`, issue requests to `/api/transparency` and `/api/auth/challenge`, and inspect the
  emitted lines.
- Run `npm test` and `npm run typecheck`.

## Out of scope

- Adding a metrics backend, APM integration, log shipping, distributed tracing, and alerting.

## Suggested labels

- `area: backend`, `area: infrastructure`, `type: enhancement`, `difficulty: medium`
