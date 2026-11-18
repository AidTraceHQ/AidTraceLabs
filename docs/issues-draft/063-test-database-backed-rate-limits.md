# Test Database-Backed Per-Address Rate Limits

**Complexity:** advanced

## Context

Authentication throttling uses a shared, database-backed counter in `server/auth.ts` (lines 149Ã¢â‚¬â€œ164) keyed per address for challenges (line 185, 8 per 15 minutes), signature attempts (line 227, 12 per minute), record writes in `server/records.ts` (line 350, 60 per minute), and re-verification (line 873, 30 per minute). The only rate-limit test exercises the in-memory express-rate-limit IP limiter in `tests/rate-limits.test.ts` (lines 7Ã¢â‚¬â€œ31); the database counter is never asserted, and the test environment neutralizes it in `tests/setup.ts` (lines 52Ã¢â‚¬â€œ54). A regression in the `ON CONFLICT ... WHERE request_count < $4` upsert (lines 154Ã¢â‚¬â€œ162) would pass silently. Affected: every user exposed to authentication or write abuse if throttling silently broke.

## Acceptance criteria

- An integration test lowers the relevant limit for one route and drives it past the threshold, asserting 429 with the documented error body.
- At least the challenge and write counters are covered; a new window resets the counter; different addresses do not share a bucket.
- The `rate_limits` row is created and incremented (queried directly or via the returned count).
- `npm test -- tests/backend.test.ts tests/rate-limits.test.ts` passes; `npm run typecheck` passes.

## Files to touch

- `tests/backend.test.ts` (or a new block in `tests/rate-limits.test.ts`)
- `tests/setup.ts` (only if a per-test limit override mechanism is required)

## Test expectations

- Configure: `TEST_DATABASE_URL`/`TEST_DATABASE_BRANCH=test`
- Run: `npm test -- tests/backend.test.ts tests/rate-limits.test.ts`
- Run: `npm run typecheck`

## Out of scope

Changing the rate-limit store technology, limits, or window values.

## Depends on

None
