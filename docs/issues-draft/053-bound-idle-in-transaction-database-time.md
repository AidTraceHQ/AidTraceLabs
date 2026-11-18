# Bound Idle Transactions Held by the Pool

**Complexity:** intermediate

## Context

The runtime pool in `server/db.ts` sets `statement_timeout` (15 s) and `query_timeout` (20 s) in the exported `pool` configuration (lines 20Ã¢â‚¬â€œ21), which bound individual statements, but nothing bounds a client that opens a transaction and then stalls before the next statement. `withTransaction` (function `withTransaction`, lines 31Ã¢â‚¬â€œ44) can leave such a client idle-in-transaction holding row locks until the connection is eventually closed. No `idle_in_transaction_session_timeout` or `idle_session_timeout` is set anywhere in `server/` (confirmed by searching the tree). Affected: concurrent writers blocked behind a stalled transaction. Current behavior: a client that runs `BEGIN` and stalls holds row locks indefinitely. Expected behavior: `idle_in_transaction_session_timeout` is set on connections, and the stalled session is terminated by the server within the configured bound.

## Acceptance criteria

- A configured `idle_in_transaction_session_timeout` is observable: `SHOW idle_in_transaction_session_timeout` on a pooled client (or the pool `options`) equals the configured value, asserted in `tests/serverless.test.ts` or `tests/backend.test.ts`.
- On the integration database, a client that runs `BEGIN` and then idles is terminated by the server within the configured bound (the next statement fails rather than hanging).
- Existing pool and transaction tests pass unchanged.
- `npm run typecheck` passes.

## Files to touch

- `server/db.ts`
- `tests/serverless.test.ts` or `tests/backend.test.ts`
- `docs/backend-design.md` (one line)

## Test expectations

- The config-only assertion runs without a database; the termination assertion needs `TEST_DATABASE_URL` and `TEST_DATABASE_BRANCH=test`.
- Run: `npm test -- tests/serverless.test.ts`
- Run: `npm run typecheck`
- For a local run without database integration, set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty.

## Out of scope

Statement/query timeout changes, pool sizing, or application-level transaction retries.

## Depends on

None
