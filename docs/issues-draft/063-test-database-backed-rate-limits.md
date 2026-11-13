# Test Database-Backed Per-Address Rate Limits

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 16 hours

**Release day:** Day 2

## Problem statement

Authentication throttling uses a shared, database-backed counter (`server/auth.ts:149-164`) keyed per address for challenges (`server/auth.ts:185`, 8 per 15 minutes), signature attempts (`server/auth.ts:227`, 12 per minute), record writes (`server/records.ts:350`, 60 per minute), and re-verification (`server/records.ts:873`, 30 per minute). The only rate-limit test exercises the in-memory express-rate-limit IP limiter (`tests/rate-limits.test.ts:7-31`); the database counter is never asserted, and the test environment neutralises it (`tests/setup.ts:52-54`). A regression in the `ON CONFLICT ... WHERE request_count < $4` upsert (`server/auth.ts:154-162`) would pass silently. Affected: every user exposed to authentication or write abuse if throttling silently broke.

## Technical implementation requirements

- Add an integration test that lowers the relevant limit for one route and drives it past the threshold, asserting 429 with the documented error body.
- Cover at least the challenge and write counters; verify a new window resets the counter and that different addresses do not share a bucket.
- Assert the `rate_limits` row is created and incremented (query the table or observe the returned count).
- Do NOT change the limits, keys, windows, or the upsert semantics, and do not remove the existing IP limiter.

## Files and areas to touch

- `tests/backend.test.ts` (or a new block in `tests/rate-limits.test.ts`)
- `tests/setup.ts` only if a per-test limit override mechanism is required

## Dependencies

- Requires a test database. Distinct from the per-IP limiter store redesign (a separate, already-drafted item).

## Measurable acceptance criteria

- Exceeding the configured threshold returns 429; under-threshold requests succeed.
- Different addresses have independent counters; a new window resets a counter.
- `npm test -- tests/backend.test.ts tests/rate-limits.test.ts` passes; `npm run typecheck` passes.

## Expected deliverables

- Database rate-limit integration tests plus a documented way to override thresholds in tests.

## How to set up and run tests

- Configure `TEST_DATABASE_URL`/`TEST_DATABASE_BRANCH=test`, then `npm test -- tests/backend.test.ts tests/rate-limits.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- Changing the rate-limit store technology, limits, or window values.

## Suggested labels

- `area: security`, `area: testing`, `type: enhancement`, `difficulty: high`.
