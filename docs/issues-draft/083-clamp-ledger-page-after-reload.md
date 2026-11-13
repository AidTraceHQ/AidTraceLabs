# Clamp the ledger page number when the filtered result set shrinks

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 1

## Problem statement

`pageNumber` is reset to `1` only by the filter-change `useEffect` (`src/App.tsx:874-876`), not when `records`
shrinks after an asynchronous reload. `pageCount` and `visibleAid` are derived from the current set
(`src/App.tsx:860-861`), so when the user is on the last page and a reload returns fewer rows, the footer span
renders `Page 2 of 1` (`src/App.tsx:1306`), the `Showing A–B of C` range text (`src/App.tsx:1293-1295`) reads
backwards, and the table body is empty even though matching rows exist on page 1. The reload is triggered by
ordinary actions such as voiding or editing a record, which call `loadTransparency` from `voidRecord`
(`src/App.tsx:714`) and `saveRecord` (`src/App.tsx:674`). Affected: any reviewer paging a filtered ledger.

## Technical implementation requirements

- Derive an effective page value (`Math.min(pageNumber, pageCount)`) and use it for `visibleAid` and
  every footer calculation.
- When the derived page is smaller than `pageNumber`, reset `pageNumber` state (an effect keyed on
  `pageCount` is acceptable) so state and view stay consistent.
- Keep the existing filter-change reset `useEffect` (`src/App.tsx:874-876`) and the Previous/Next buttons
  (`src/App.tsx:1298-1313`).
- Do not change filtering, sorting, page size, or the API calls.

## Files and areas to touch

- `src/App.tsx`
- `tests/` (a focused unit/component test for the clamp helper if the logic is extracted)

## Dependencies

- None.

## Measurable acceptance criteria

- With 11 records and `pageSize = 10`, navigate to page 2, void one record so `filteredAid.length` becomes 10,
  and assert the footer renders `Page 1 of 1` and `visibleAid` is non-empty (component test).
- The footer string satisfies `(pageNumber-1)*pageSize+1 <= min(pageNumber*pageSize, filteredAid.length) <=
filteredAid.length` on every page (asserted in the test).
- `Previous` is disabled when the effective page is 1 and `Next` is disabled when it equals `pageCount`
  (asserted via the button `disabled` prop).
- `npm run typecheck` and `npm test` exit 0.

## Expected deliverables

- Clamped pagination logic plus a test.

## How to set up and run tests

- Run `npm run dev`, create enough records to fill two pages, open the last page, then void a record
  and confirm the footer and table stay consistent.
- Run `npm test` and `npm run typecheck`.

## Out of scope

- Cursor pagination UI (existing GitHub issue #22), server-side totals, or page-size controls.

## Suggested labels

- `area: frontend`, `type: bug`, `difficulty: medium`
