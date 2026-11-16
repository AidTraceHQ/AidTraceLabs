# Sort the Ledger on the Server and Bind Cursors to the Sort

**Complexity:** high

## Context

Partly overlaps with open issue "Cursor Pagination UI". This draft is narrowed to the server-side sort parameter and cursor-binding; UI pagination controls remain in that separate issue.

Sorting is performed in the browser over the fully loaded dataset in `src/App.tsx` (sort buttons at lines 878–884, applied at lines 804–820). This cannot be correct once paging is bounded because the browser can only sort rows it holds. The list route already paginates with signed cursors bound to query filters but exposes no sort parameter, coupling "sort works" to "load everything". Affected: the long-term scalability of the public ledger.

## Acceptance criteria

- `GET /api/transparency?sort=amount&direction=desc&limit=N` returns rows in the requested order with a stable tiebreaker across pages.
- A cursor issued for `sort=date` is rejected when replayed with `sort=amount`.
- An unknown `sort` value returns `400`.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.

## Files to touch

- `server/records.ts`
- `src/App.tsx`
- `docs/api.md`
- `tests/backend.test.ts`
- `tests/` (a cursor/sort binding test)

## Test expectations

- Configure: `TEST_DATABASE_URL`, `TEST_DATABASE_BRANCH=test`
- Run: `npm test -- tests/backend.test.ts`
- Manual: run `npm run dev` and confirm the ledger sort headers reorder rows correctly across pages.

## Out of scope

Cursor pagination UI controls (tracked by the separate open issue "Cursor Pagination UI"), multi-column sort, saved sort preferences, and full-text ranking.

## Depends on

Return a bounded total so the ledger can page without loading every record
