# Bound the Total Duration of a Verification Request

**Complexity:** intermediate

## Context

`checkTransaction` in `server/stellar-verification.ts` fetches the transaction and then reads operations in up to 20 pages (constants `operationPageSize`/`operationPageLimit` at lines 38Ã¢â‚¬â€œ39), each issued by `getJson` (function `getJson`, lines 131Ã¢â‚¬â€œ134) with its own independent 10-second abort inside the operations loop (lines 228Ã¢â‚¬â€œ278). There is no overall time budget. The verification work behind `POST /api/records/:id/verify` (handler at `server/records.ts`, lines 870Ã¢â‚¬â€œ914), the `POST /api/records` block (lines 848Ã¢â‚¬â€œ864), and the `PUT /api/records/:id` block (lines 1007Ã¢â‚¬â€œ1023) can occupy a handler for roughly 200 seconds or more, exceeding typical reverse-proxy and serverless function limits. Affected: clients and deployments with a proxy or function timeout.

## Acceptance criteria

- A new test in `tests/backend.test.ts` (e.g. `it('returns pending before the overall verification deadline')`) stubs `fetch` so each operations page resolves after the deadline; the call returns `status: 'pending'` with a `reason`, and the measured elapsed time is below the configured deadline.
- Existing tests for `verified`, `mismatch`, and `not-found` still pass unchanged.
- `npm test -- tests/backend.test.ts` passes and `npm run typecheck` passes.

## Files to touch

- `server/stellar-verification.ts`
- `server/records.ts` (only if a route-level deadline needs threading through)
- `tests/backend.test.ts`

## Test expectations

- Verification tests use a stubbed global `fetch`; run: `npm test -- tests/backend.test.ts` (database only needed if record-writing routes are exercised).
- Run: `npm run typecheck`

## Out of scope

Changing the matching algorithm, adding retries, scheduled reverification, or altering the 20-page bound.

## Depends on

None
