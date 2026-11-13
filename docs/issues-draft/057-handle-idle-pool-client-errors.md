# Handle idle database-client errors on the connection pool

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 2

## Problem statement

The shared pool is constructed without an `error` listener (`server/db.ts:14-22`, the exported `pool`), and no other module
registers one either (the `shutdown` function in `server/index.ts:14-28` only handles process signals). `pg`'s `Pool`
is an `EventEmitter` that emits `error` when a client that is **idle in the pool** loses its
connection — common on Neon when a Fluid-compute instance is scaled down or a network path is reaped.
Node's default behaviour for an unhandled `error` event is to throw, so a single dropped idle
connection can terminate the API process or fail an unrelated serverless invocation. The liveness
endpoint (the `/api/_healthcheck` handler, `server/app.ts:20-22`) returns `{ ok: true }` regardless, so a crash is not observable from
the outside. Affected: production availability and any operator relying on the documented
process-liveness check (`docs/deployment.md`).

## Technical implementation requirements

- Register `pool.on('error', handler)` in `server/db.ts` immediately after the pool is created.
- The handler must log one safe message and must **not** rethrow. It must never print the connection
  string, host, database, user, or password — reuse the safe-field approach already used in
  `logDatabaseFailure` (`server/database-errors.ts:37`).
- Do not change `max`, `connectionTimeoutMillis`, `idleTimeoutMillis`, `allowExitOnIdle`,
  `query_timeout`, or `statement_timeout` (`server/db.ts:14-22`, the exported `pool`).
- Do not change `withTransaction` (`server/db.ts:31-44`).
- Add a focused test that emits `'error'` on the exported pool and asserts the process does not throw
  and the handler ran.

## Files and areas to touch

- `server/db.ts`
- `tests/db-pool.test.ts` (new)
- `docs/backend-design.md` (one-line note under connection handling)

## Dependencies

- None. Distinct from the process-level `unhandledRejection`/`uncaughtException` handling draft: that
  covers stray promises and synchronous throws, this covers the pool's own event.

## Measurable acceptance criteria

- After importing `server/db.ts`, `pool.listenerCount('error') >= 1`.
- In the new test, `pool.emit('error', new Error('idle client dropped'))` does not throw and the
  handler is invoked exactly once.
- The captured `console.error` argument emitted by the handler contains none of the private parts of `process.env.DATABASE_URL` (no host, database, user, or password substring).
- `npm test -- tests/db-pool.test.ts` passes and `npm run typecheck` succeeds.

## Expected deliverables

- A pool `error` listener with a safe log line, a unit test, and a short note in the backend design
  document.

## How to set up and run tests

- Run `npm test -- tests/db-pool.test.ts` (no database is required for this unit test).
- Run `npm run typecheck`.
- Optionally run `npm run dev` and confirm the normal startup log still appears.

## Out of scope

- Connection retry policy, pool sizing, a database-readiness health check, and any change to how
  transient query errors are classified.

## Suggested labels

- `area: backend`, `type: bug`, `difficulty: medium`
