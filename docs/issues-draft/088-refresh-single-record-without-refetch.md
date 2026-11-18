# Add a Single-Record Endpoint and Stop Refetching the Ledger to Refresh One Row

**Complexity:** advanced

## Context

Refreshing a single record re-downloads the whole ledger. `getLatestRecord` in `src/App.tsx` (function `getLatestRecord`, lines 288Ã¢â‚¬â€œ301) calls `api.getAllPages('/api/transparency?q=<id>')` and searches the returned pages. `getAllPages` in `src/api.ts` (lines 83Ã¢â‚¬â€œ119) walks the entire cursor chain, so a one-row refresh costs one request per page of matches. The verify and update paths follow the same pattern (lines 689Ã¢â‚¬â€œ690 in `verifyRecord` and lines 743Ã¢â‚¬â€œ744 in `editRecord`). There is no single-record route in the documented API in `docs/api.md` (lines 5Ã¢â‚¬â€œ22). Affected: any user verifying or editing a record while the ledger is large.

## Acceptance criteria

- `GET /api/records/:id` returns the record for a valid id and `404 { "error": "Record not found." }` for an unknown id.
- For a consent-off record, the new route returns a body equal to the `/api/transparency` row for the same id (same withheld fields; test asserts no direct identifiers appear when the list route withholds them).
- A verify/edit issues one `GET /api/records/:id` request instead of `getAllPages` walking the cursor chain (observable in the network panel: one request, not one per page).
- `npm test -- tests/backend.test.ts` and `npm run typecheck` exit 0.

## Files to touch

- `server/records.ts`
- `src/App.tsx`
- `src/api.ts` (typed helper for the new route)
- `docs/api.md` (one row for the new endpoint)
- `tests/backend.test.ts`

## Test expectations

- Configure: `TEST_DATABASE_URL`, `TEST_DATABASE_BRANCH=test`
- Run: `npm test -- tests/backend.test.ts`
- Manual: run `npm run dev` and verify a record from the ledger while watching the network panel.

## Out of scope

Changing list pagination or totals, adding field-level access changes, and any UI redesign beyond the fetch swap.

## Depends on

None
