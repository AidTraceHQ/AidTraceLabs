# Cache Negative Verification Outcomes to Stop Repeat Horizon Lookups

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 8 hours

**Release day:** Day 3

## Problem statement

`cachedVerification` returns a cache hit only when the latest result is `verified` or `mismatch` and its `cache_expires_at` is still in the future (`server/records.ts:679-690`), and `storeVerification` sets `cache_expires_at` only for those two statuses via `CASE WHEN $3 IN ('verified', 'mismatch') THEN NOW() + INTERVAL '1 hour' END` (`server/records.ts:641-677`, specifically line 655). As a result, a `not-found` or `pending` result is recomputed and a fresh row is inserted on every `POST /api/records/:id/verify` call (`server/records.ts:870-914`), and each such call issues one transaction GET plus up to twenty operation GETs to Horizon (`server/stellar-verification.ts:228-278`). Affected: any reviewer repeatedly pressing Verify on a hash Horizon has not yet indexed, and Horizon itself, which receives redundant traffic. `docs/backend-design.md:225` records that "Pending and other statuses do not receive a cache expiry", confirming this is current behaviour rather than an accident.

## Technical implementation requirements

- Add a bounded freshness window for definitively negative results: cache `not-found` for a short interval (for example five minutes) so repeated Verify calls inside that window are served from storage without contacting Horizon.
- Leave `pending` uncached so transient failures are always re-attempted, and keep `verified`/`mismatch` at the existing one-hour window.
- Implement the window in `storeVerification`'s `cache_expires_at` expression and in `cachedVerification`'s status predicate so the two remain in agreement.
- Do NOT change status values, the matching algorithm, the audit behaviour, or the verification rate limit.
- Update the cache wording in `docs/backend-design.md`.

## Files and areas to touch

- `server/records.ts`
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Dependencies

- None. Distinct from existing GitHub issue #18 (scheduled reverification) and from draft "Clean Up Expired Authentication and Rate-Limit Rows", whose scope explicitly excludes verification history.

## Measurable acceptance criteria

- A `not-found` result is cached for the bounded window; a second `/verify` inside that window performs zero additional Horizon fetches (asserted against the mocked `fetch` call count).
- A `pending` result is never cached; a second `/verify` re-attempts Horizon.
- `verified` and `mismatch` keep the one-hour window.
- `npm test -- tests/backend.test.ts` passes and `npm run typecheck` passes.

## Expected deliverables

- The bounded negative-cache change in `server/records.ts` and database-backed tests proving cache hits and misses per status.

## How to set up and run tests

- To skip database integration locally, set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty in the shell, then run `npm test -- tests/backend.test.ts`; the Horizon tests use a mocked `fetch`.
- Run `npm run typecheck`.

## Out of scope

- Changing verification statuses, the matching algorithm, the rate limit, or adding a background or scheduled job.

## Suggested labels

- `area: backend`, `type: enhancement`, `difficulty: medium`.
