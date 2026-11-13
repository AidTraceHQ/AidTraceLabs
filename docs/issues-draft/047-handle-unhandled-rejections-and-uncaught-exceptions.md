# Handle Unhandled Rejections and Uncaught Exceptions

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 8 hours

**Release day:** Day 1

## Problem statement

`server/index.ts` registers only `SIGINT` and `SIGTERM` handlers and starts shutdown with `void shutdown(...)` (`server/index.ts:30-31`). There are no `unhandledRejection` or `uncaughtException` handlers anywhere in `server/` (confirmed by searching the `server/` tree for both names). A rejected promise or an uncaught throw therefore either terminates the process with a raw stack trace or, in the `void shutdown(...)` case, is discarded entirely, leaving the process running in an undefined state. Affected: self-hosted operators who get no safe signal on background failure, and any request whose detached work rejects.

## Technical implementation requirements

- Register `process.once('unhandledRejection', ...)` and `process.once('uncaughtException', ...)` handlers in `server/index.ts`.
- Each handler must log a short, safe message and then run the existing shutdown path, setting `process.exitCode = 1`.
- Do NOT swallow the error and keep serving; an uncaught exception must lead to termination.
- The log output must not print `DATABASE_URL`, `SESSION_SECRET`, `PSEUDONYM_SECRET`, request bodies, or full error objects.
- Keep the existing `SIGINT`/`SIGTERM` behavior; do NOT add a logging dependency.

## Files and areas to touch

- `server/index.ts`
- `tests/` (a small unit test around an exported handler function)
- `docs/backend-design.md` (one line noting crash handling)

## Dependencies

- The forced exit after a grace deadline should reuse the graceful-shutdown bound; until that lands, exit immediately after logging.

## Measurable acceptance criteria

- Both handlers are registered; a simulated rejection invokes the exit path with a non-zero `process.exitCode`.
- Captured log output contains no connection string and no session/pseudonym secret value.
- `npm run typecheck` and `npm test` pass.

## Expected deliverables

- Crash/rejection handlers, a focused unit test, and a one-line design note.

## How to set up and run tests

- Run the new test with `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty (PowerShell: `$env:TEST_DATABASE_URL=''; $env:TEST_DATABASE_URL_UNPOOLED=''`), then `npm test -- tests/` for the affected file.
- Run `npm run typecheck`.

## Out of scope

- Metrics/alerting integration, process managers, or changing route error handling.

## Suggested labels

- `area: backend`, `area: infrastructure`, `type: enhancement`, `difficulty: medium`
