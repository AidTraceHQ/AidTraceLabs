# Bound the Local Server Graceful Shutdown

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 2

## Problem statement

The SIGINT/SIGTERM `shutdown(signal)` handler waits for `server.close` and then `pool.end` without a grace deadline (`server/index.ts:14-28`). A long-lived or stuck request can keep a local/container process alive indefinitely during shutdown.

## Technical implementation requirements

- Introduce one configurable, validated shutdown grace period with a documented default.
- Stop accepting new connections immediately; allow in-flight work to finish until the deadline.
- At deadline, close remaining idle/active sockets using supported Node server APIs, then close the pool exactly once.
- Keep shutdown idempotent for overlapping signals and return a nonzero process status when cleanup fails.

## Files and areas to touch

- `server/index.ts`
- `server/environment.ts`
- `tests/` (server lifecycle tests)
- `docs/deployment.md`

## Dependencies

- None.

## Measurable acceptance criteria

- Test `drains an in-flight request that finishes before the deadline and closes the pool once` asserts `pool.end` is called exactly once.
- Test `does not hang shutdown past the configured bound` uses fake timers with a request that outlives the deadline and asserts shutdown resolves within `graceMs` and `pool.end` is called once.
- Test `does not start concurrent pool shutdowns for repeated signals` asserts `pool.end` is called once after two SIGTERM events.
- Test `rejects an invalid grace timeout with a variable-name-only message` asserts the thrown message contains the variable name and neither its value nor any secret.
- `npx vitest run tests/server-lifecycle.test.ts` passes.

## Expected deliverables

- Bounded shutdown lifecycle, fake-server/fake-pool tests, and operator documentation.

## How to set up and run tests

- Run the focused server lifecycle test (new `tests/server-lifecycle.test.ts`) with `npx vitest run tests/server-lifecycle.test.ts`.
- Run `npm run typecheck` and `npm run lint`.

## Out of scope

- Vercel Function lifecycle behavior, forced process termination without a deadline, or database retry policy.

## Suggested labels

- `area: backend`, `area: infrastructure`, `type: enhancement`, `difficulty: medium`.
