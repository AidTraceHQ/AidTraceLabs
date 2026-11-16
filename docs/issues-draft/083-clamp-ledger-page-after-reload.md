# Clamp the Ledger Page Number When the Filtered Result Set Shrinks

**Complexity:** medium

## Context

`pageNumber` in `src/App.tsx` is reset to `1` only by the filter-change `useEffect` (lines 874–876), not when `records` shrinks after an asynchronous reload. `pageCount` and `visibleAid` are derived from the current set (lines 860–861). When the user is on the last page and a reload returns fewer rows, the footer renders `Page 2 of 1` (line 1306), the `Showing A–B of C` range text (lines 1293–1295) reads backwards, and the table body is empty even though matching rows exist on page 1. The reload is triggered by ordinary actions such as voiding or editing a record via `loadTransparency` from `voidRecord` (line 714) and `saveRecord` (line 674). Affected: any reviewer paging a filtered ledger.

## Acceptance criteria

- With 11 records and `pageSize = 10`, navigate to page 2, void one record so `filteredAid.length` becomes 10, and assert the footer renders `Page 1 of 1` and `visibleAid` is non-empty (component test).
- The footer string satisfies `(pageNumber-1)*pageSize+1 <= min(pageNumber*pageSize, filteredAid.length) <= filteredAid.length` on every page (asserted in the test).
- `Previous` is disabled when the effective page is 1 and `Next` is disabled when it equals `pageCount` (asserted via the button `disabled` prop).
- `npm run typecheck` and `npm test` exit 0.

## Files to touch

- `src/App.tsx`
- `tests/` (a focused unit/component test for the clamp helper if the logic is extracted)

## Test expectations

- Run: `npm test`
- Run: `npm run typecheck`
- Manual check: create enough records to fill two pages, open the last page, void a record, confirm footer and table are consistent.

## Out of scope

Cursor pagination UI (tracked by a separate open issue), server-side totals, or page-size controls.

## Depends on

None
