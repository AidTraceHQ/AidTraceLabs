# Bound the Local Server Graceful Shutdown

**Complexity:** medium

## Context

The `SIGINT`/`SIGTERM` `shutdown(signal)` handler in `server/index.ts` (function `shutdown`, lines 14–28) waits for `server.close` and then `pool.end` without a grace deadline. A long-lived or stuck request can keep a local/container process alive indefinitely during shutdown. Affected users: self-hosted operators and container orchestrators relying on predictable shutdown behavior. Current behavior: shutdown waits indefinitely for in-flight requests; `pool.end` is called only after the server closes. Expected behavior: one configurable, validated shutdown grace period bounds the wait; at deadline, remaining idle/active sockets are closed using supported Node server APIs, the pool is closed exactly once, overlapping signals are idempotent, and a non-zero exit code is returned when cleanup fails.

## Acceptance criteria

- Test `drains an in-flight request that finishes before the deadline and closes the pool once` asserts `pool.end` is called exactly once.
- Test `does not hang shutdown past the configured bound` uses fake timers with a request that outlives the deadline and asserts shutdown resolves within `graceMs` and `pool.end` is called once.
- Test `does not start concurrent pool shutdowns for repeated signals` asserts `pool.end` is called once after two SIGTERM events.
- Test `rejects an invalid grace timeout with a variable-name-only message` asserts the thrown message contains the variable name and neither its value nor any secret.
- `npx vitest run tests/server-lifecycle.test.ts` passes.

## Files to touch

- `server/index.ts`
- `server/environment.ts`
- `tests/server-lifecycle.test.ts` (new)
- `docs/deployment.md`

## Test expectations

- Run: `npx vitest run tests/server-lifecycle.test.ts`
- Run: `npm run typecheck`
- Run: `npm run lint`
- No live database required.

## Out of scope

Vercel Function lifecycle behavior, forced process termination without a deadline, or database retry policy.

## Depends on

None
