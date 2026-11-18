# Bound How Long a Request Waits for a Pooled Database Client

**Complexity:** intermediate

## Context

The runtime pool is configured with `max` and `connectionTimeoutMillis` in `server/db.ts` (lines 14Ã¢â‚¬â€œ22, the exported `pool`), and `withTransaction` (function `withTransaction`, lines 31Ã¢â‚¬â€œ44) awaits `pool.connect()` with no application-level deadline. `connectionTimeoutMillis` bounds establishing a new connection; there is no explicit bound on how long a caller waits for a free client when the pool is already at `max`. Under the `VERCEL` configuration the pool is only 3 clients (the `serverless` constant and `max` at lines 12Ã¢â‚¬â€œ16). Affected: requests under burst load or when a client is held by a stalled operation. Current behavior: callers wait without a defined ceiling. Expected behavior: a bounded wait fails with a clear transient/database-unavailable outcome mapping to the existing 503 path; a late-arriving client is released immediately.

## Acceptance criteria

- With a fake pool whose `connect()` never resolves, `withTransaction` rejects within the configured bound, and `databaseUnavailableResponse` applied to that error returns `{ status: 503, body: { error: 'database_unavailable' } }`.
- With a fake pool whose `connect()` resolves only after the deadline, the late client's `release()` is called (spy asserted), so no client leaks.
- Existing transaction and 503 tests pass; `npm run typecheck` passes.

## Files to touch

- `server/db.ts`
- `server/database-errors.ts` (only if a new transient classification is needed)
- `tests/backend.test.ts` or `tests/database-errors.test.ts`

## Test expectations

- Set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty.
- Run: `npm test`
- Run: `npm run typecheck`

## Out of scope

Changing pool size, adding a general retry policy, or a shared rate-limit store.

## Depends on

None
