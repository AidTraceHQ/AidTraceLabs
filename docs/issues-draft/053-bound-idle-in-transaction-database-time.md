# Bound Idle Transactions Held by the Pool

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 2

## Problem statement

The runtime pool sets `statement_timeout` (15 s) and `query_timeout` (20 s) (`server/db.ts:20-21`, the `query_timeout`/`statement_timeout` entries in the exported `pool` configuration), which bound individual statements, but nothing bounds a client that opens a transaction and then stalls before the next statement. `withTransaction` (`server/db.ts:31-44`) can leave such a client idle-in-transaction holding row locks until the connection is eventually closed. No `idle_in_transaction_session_timeout` or `idle_session_timeout` is set anywhere in `server/` (confirmed by searching the tree). Affected: concurrent writers blocked behind a stalled transaction.

## Technical implementation requirements

- Set `idle_in_transaction_session_timeout` on connections (for example via the pool `options` parameter or immediately after `BEGIN` in `withTransaction`), and consider `idle_session_timeout` for the serverless pool.
- Keep the existing `statement_timeout`, `query_timeout`, and pool sizing (`server/db.ts:14-22`, the exported `pool`) unchanged.
- Do NOT change transaction boundaries, the BEGIN/COMMIT/ROLLBACK sequence, or application query text beyond the timeout setting.
- Do NOT alter rollback error handling (tracked by a separate draft).

## Files and areas to touch

- `server/db.ts`
- `tests/serverless.test.ts` or `tests/backend.test.ts`
- `docs/backend-design.md` (one line)

## Dependencies

- Independent of the rollback-masking draft. Distinct from the migration-pool timeout work.

## Measurable acceptance criteria

- A configured `idle_in_transaction_session_timeout` is observable: `SHOW idle_in_transaction_session_timeout` on a pooled client (or the pool `options`) equals the configured value, asserted in `tests/serverless.test.ts` or `tests/backend.test.ts`.
- On the integration database, a client that runs `BEGIN` and then idles is terminated by the server within the configured bound (the next statement fails rather than hanging).
- The existing pool and transaction tests pass unchanged.
- `npm run typecheck` passes.

## Expected deliverables

- Idle-in-transaction timeout configuration, a focused test, and a one-line design note.

## How to set up and run tests

- The config-only assertion runs without a database; the termination assertion needs `TEST_DATABASE_URL` and `TEST_DATABASE_BRANCH=test`.
- Run `npm test -- tests/serverless.test.ts` and `npm run typecheck`.
- For a local run without database integration, set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty.

## Out of scope

- Statement/query timeout changes, pool sizing, or application-level transaction retries.

## Suggested labels

- `area: backend`, `type: enhancement`, `difficulty: medium`
