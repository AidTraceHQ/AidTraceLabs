# Cache Negative Verification Outcomes to Stop Repeat Horizon Lookups

**Complexity:** medium

## Context

`cachedVerification` in `server/records.ts` returns a cache hit only when the latest result is `verified` or `mismatch` and `cache_expires_at` is still in the future (lines 679–690). `storeVerification` sets `cache_expires_at` only for those two statuses via `CASE WHEN $3 IN ('verified', 'mismatch') THEN NOW() + INTERVAL '1 hour' END` (lines 641–677). A `not-found` or `pending` result is recomputed on every `POST /api/records/:id/verify` call (handler at lines 870–914), each issuing one transaction GET plus up to twenty operation GETs to Horizon (lines 228–278). `docs/backend-design.md` (line 225) records that "Pending and other statuses do not receive a cache expiry", confirming this is current behavior. Affected: reviewers repeatedly pressing Verify on a hash Horizon has not yet indexed, and Horizon itself receiving redundant traffic.

## Acceptance criteria

- A `not-found` result is cached for the bounded window; a second `/verify` inside that window performs zero additional Horizon fetches (asserted against the mocked `fetch` call count).
- A `pending` result is never cached; a second `/verify` re-attempts Horizon.
- `verified` and `mismatch` keep the one-hour window.
- `npm test -- tests/backend.test.ts` passes and `npm run typecheck` passes.

## Files to touch

- `server/records.ts`
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Test expectations

- Set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty; Horizon tests use mocked `fetch`.
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Changing verification statuses, the matching algorithm, the rate limit, or adding a background or scheduled job. Scheduled reverification is tracked by a separate open issue.

## Depends on

None
