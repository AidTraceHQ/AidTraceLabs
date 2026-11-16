# Configure Explicit HTTP Server Timeouts

**Complexity:** medium

## Context

The HTTP server is started with `app.listen(port, callback)` and no timeout configuration in `server/index.ts` (lines 10–12). No `requestTimeout`, `headersTimeout`, or `keepAliveTimeout` is set anywhere in `server/` (confirmed by searching the tree). The server relies only on Node defaults, and a slow or partially-sent request can occupy a connection for the full default request timeout. Affected: self-hosted operators facing slow-client or partial-request load. Current behavior: no explicit timeouts are set; Node defaults apply. Expected behavior: after `app.listen`, `server.requestTimeout`, `server.headersTimeout`, and `server.keepAliveTimeout` are set to explicit finite values with comments explaining each choice; `headersTimeout <= requestTimeout`.

## Acceptance criteria

- `server.requestTimeout`, `server.headersTimeout`, and `server.keepAliveTimeout` are set to finite positive integers at startup; a unit test asserts the configured values (extract the assignment into a small testable function if needed).
- `npm run typecheck` and `npm test` pass.

## Files to touch

- `server/index.ts`
- `server/environment.ts` (only if new variables are added)
- `tests/` (assert the configured values)
- `docs/backend-design.md` (one line)

## Test expectations

- Set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty.
- Run: `npm run typecheck`
- Run: `npm test`

## Out of scope

Adding a request-duration middleware, connection pooling changes, or proxy configuration.

## Depends on

None
