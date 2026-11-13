# Bound How Long a Request Waits for a Pooled Database Client

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 1

## Problem statement

The runtime pool is configured with `max` and `connectionTimeoutMillis` (`server/db.ts:14-22`, the exported `pool`), and `withTransaction` awaits `pool.connect()` with no application-level deadline (`server/db.ts:31-44`). `connectionTimeoutMillis` bounds establishing a new connection; there is no explicit, documented bound on how long a caller waits for a free client when the pool is already at `max`. If every client is busy or a request is stalled (the pool is only 3 clients under `VERCEL`, the `serverless` constant and `max` at `server/db.ts:12-16`), callers can wait without a defined ceiling. Affected: requests under burst load or when a client is held by a stalled operation.

## Technical implementation requirements

- Add a bounded wait when acquiring a pooled client so a caller fails with a clear, retryable outcome instead of waiting indefinitely.
- If a client becomes available after the wait deadline has already elapsed, release it immediately so no client leaks.
- Surface the timeout as a transient/database-unavailable condition so it maps to the existing 503 path rather than a generic 500.
- Keep the pool sizing, `statement_timeout`, and `query_timeout` (`server/db.ts:14-22`, the exported `pool`) unchanged.
- Do NOT change transaction boundaries, query text, or the `withTransaction` signature.

## Files and areas to touch

- `server/db.ts`
- `server/database-errors.ts` (only if a new transient classification is needed)
- `tests/backend.test.ts` or `tests/database-errors.test.ts`

## Dependencies

- Overlaps in spirit with the transient-classification draft (049) only if a new code is introduced; prefer reusing the existing 503 mapping. Distinct from the idle-in-transaction timeout work.

## Measurable acceptance criteria

- With a fake pool whose `connect()` never resolves, `withTransaction` rejects within the configured bound, and `databaseUnavailableResponse` applied to that error returns `{ status: 503, body: { error: 'database_unavailable' } }`.
- With a fake pool whose `connect()` resolves only after the deadline, the late client's `release()` is called (asserted with a spy), so no client leaks.
- Existing transaction and 503 tests pass; `npm run typecheck` passes.

## Expected deliverables

- A bounded client-acquisition path with fake-pool tests for the timeout, the late-arrival release, and the 503 mapping.

## How to set up and run tests

- The fake-pool tests run without a database; set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty (PowerShell: `$env:TEST_DATABASE_URL=''; $env:TEST_DATABASE_URL_UNPOOLED=''`), then `npm test`.
- Run `npm run typecheck`.

## Out of scope

- Changing pool size, adding a general retry policy, or a shared rate-limit store.

## Suggested labels

- `area: backend`, `type: enhancement`, `difficulty: medium`
