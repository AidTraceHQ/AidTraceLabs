# Bound Horizon Verification With Bounded Retries and a Total Deadline

**Complexity:** high

## Context

`getJson` in `server/stellar-verification.ts` (function `getJson`, lines 130–141) performs exactly one GET with a per-request 10-second abort and no retry, so a single transient transport error immediately becomes `pending` (lines 176–187). The same helper is called inside a loop of up to twenty sequential operation GETs (lines 228–278). The worst case is roughly twenty times ten seconds of wall time for one `/verify` request, which can exceed serverless or edge timeouts. Affected: organizations on flaky networks who must retry manually, and operators whose functions can time out on operation-heavy transactions.

## Acceptance criteria

- A transaction GET that throws once is retried and can still reach `verified` or `mismatch`.
- A persistent failure exhausts the bounded retries and returns `pending` with the existing safe reason; the attempt count is bounded and asserted.
- A slow operation endpoint cannot consume more than the overall deadline; the pass returns `pending` before exhausting the page loop.
- A `404` transaction response is never retried.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.

## Files to touch

- `server/stellar-verification.ts`
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Test expectations

- Set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty; Horizon tests use mocked `fetch`.
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Changing eligible operation types or matching fields, altering rate limits, or adding a background/scheduled verifier (tracked by a separate open issue).

## Depends on

Bound the Total Duration of a Verification Request
