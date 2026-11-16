# Handle Idle Database-Client Errors on the Connection Pool

**Complexity:** medium

## Context

The shared pool is constructed without an `error` listener in `server/db.ts` (lines 14–22, the exported `pool`), and no other module registers one either. `pg`'s `Pool` is an `EventEmitter` that emits `error` when a client that is idle in the pool loses its connection — common on Neon when a Fluid-compute instance scales down or a network path is reaped. Node's default behavior for an unhandled `error` event is to throw, so a single dropped idle connection can terminate the API process or fail an unrelated serverless invocation. The liveness endpoint returns `{ ok: true }` regardless, so a crash is not observable from the outside. Affected: production availability and operators relying on the liveness check in `docs/deployment.md`.

## Acceptance criteria

- After importing `server/db.ts`, `pool.listenerCount('error') >= 1`.
- In the new test, `pool.emit('error', new Error('idle client dropped'))` does not throw and the handler is invoked exactly once.
- The captured `console.error` argument emitted by the handler contains none of the private parts of `process.env.DATABASE_URL` (no host, database, user, or password substring).
- `npm test -- tests/db-pool.test.ts` passes and `npm run typecheck` succeeds.

## Files to touch

- `server/db.ts`
- `tests/db-pool.test.ts` (new)
- `docs/backend-design.md` (one-line note under connection handling)

## Test expectations

- Run: `npm test -- tests/db-pool.test.ts` (no database required for this unit test)
- Run: `npm run typecheck`

## Out of scope

Connection retry policy, pool sizing, a database-readiness health check, or changing how transient query errors are classified.

## Depends on

None
