# Handle Unhandled Rejections and Uncaught Exceptions

**Complexity:** medium

## Context

`server/index.ts` registers only `SIGINT` and `SIGTERM` handlers and starts shutdown with `void shutdown(...)` (lines 30–31). No `unhandledRejection` or `uncaughtException` handlers exist anywhere in `server/` (confirmed by searching the tree). A rejected promise or uncaught throw therefore either terminates the process with a raw stack trace or is discarded entirely via `void`, leaving the process running in an undefined state. Affected: self-hosted operators who get no safe signal on background failure, and any request whose detached work rejects. Current behavior: unhandled rejections are silently dropped or crash the process without a controlled shutdown. Expected behavior: `process.once('unhandledRejection', ...)` and `process.once('uncaughtException', ...)` handlers log a short safe message, run the existing shutdown path, and set `process.exitCode = 1`. The log output must not print `DATABASE_URL`, `SESSION_SECRET`, `PSEUDONYM_SECRET`, request bodies, or full error objects.

## Acceptance criteria

- Both handlers are registered; a simulated rejection invokes the exit path with a non-zero `process.exitCode`.
- Captured log output contains no connection string and no session/pseudonym secret value.
- `npm run typecheck` and `npm test` pass.

## Files to touch

- `server/index.ts`
- `tests/` (a small unit test around an exported handler function)
- `docs/backend-design.md` (one line noting crash handling)

## Test expectations

- Set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty.
- Run: `npm test -- tests/` (for the affected file)
- Run: `npm run typecheck`

## Out of scope

Metrics/alerting integration, process managers, or changing route error handling.

## Depends on

Bound the Local Server Graceful Shutdown
