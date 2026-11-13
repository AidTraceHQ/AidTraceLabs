# Configure Explicit HTTP Server Timeouts

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 8 hours

**Release day:** Day 3

## Problem statement

The HTTP server is started with `app.listen(port, callback)` and no timeout configuration (`server/index.ts:10-12`). No `requestTimeout`, `headersTimeout`, or `keepAliveTimeout` is set anywhere in `server/` (confirmed by searching the tree for all three names). The server therefore relies only on Node defaults, and a slow or partially-sent request can occupy a connection for the full default request timeout on a process that, when self-hosted, is a single instance. Affected: self-hosted operators facing slow-client or partial-request load.

## Technical implementation requirements

- After `app.listen`, set `server.requestTimeout`, `server.headersTimeout`, and `server.keepAliveTimeout` to explicit finite values with a short comment explaining each choice.
- Keep `headersTimeout <= requestTimeout` and choose a `keepAliveTimeout` compatible with any fronting proxy idle timeout.
- If any value is exposed as configuration, validate it with `integerEnvironmentVariable` from `server/environment.ts`, matching the existing rate-limit variables.
- Do NOT change route behavior, the port validation (`server/index.ts:5-8`), or the shutdown path (`server/index.ts:14-28`).

## Files and areas to touch

- `server/index.ts`
- `server/environment.ts` (only if new variables are added)
- `tests/` (assert the configured values)
- `docs/backend-design.md` (one line)

## Dependencies

- None. Distinct from the graceful-shutdown bound and from the rate-limit sharing draft.

## Measurable acceptance criteria

- `server.requestTimeout`, `server.headersTimeout`, and `server.keepAliveTimeout` are set to finite positive integers at startup; a unit test asserts the configured values (extract the assignment into a small testable function if needed).
- `npm run typecheck` and `npm test` pass.

## Expected deliverables

- Explicit server timeout configuration and a focused test for the values.

## How to set up and run tests

- Run the new test with `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty (PowerShell: `$env:TEST_DATABASE_URL=''; $env:TEST_DATABASE_URL_UNPOOLED=''`).
- Run `npm run typecheck`.

## Out of scope

- Adding a request-duration middleware, connection pooling changes, or proxy configuration.

## Suggested labels

- `area: backend`, `area: infrastructure`, `type: enhancement`, `difficulty: medium`
