# Bound the Local Server Graceful Shutdown

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 12 hours

**Release day:** Day 2

## Problem statement

The SIGINT/SIGTERM handler waits for `server.close` and then `pool.end` without a grace deadline (`server/index.ts:14-28`). A long-lived or stuck request can keep a local/container process alive indefinitely during shutdown.

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

- A request that finishes before the deadline drains cleanly and the pool closes once.
- A request that outlives the deadline does not hang shutdown past the configured bound.
- Repeated SIGTERM/SIGINT events do not start concurrent pool shutdowns.
- Invalid timeout configuration fails with a safe variable-name-only error.

## Expected deliverables

- Bounded shutdown lifecycle, fake-server/fake-pool tests, and operator documentation.

## How to set up and run tests

- Run the focused server lifecycle test (new `tests/server-lifecycle.test.ts`) with `npx vitest run tests/server-lifecycle.test.ts`.
- Run `npm run typecheck` and `npm run lint`.

## Out of scope

- Vercel Function lifecycle behavior, forced process termination without a deadline, or database retry policy.

## Suggested labels

- `area: backend`, `area: infrastructure`, `type: enhancement`, `difficulty: high`.
