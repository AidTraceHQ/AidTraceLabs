# Add Table Semantics and Keyboard Scrolling to the Data Tables

**Complexity:** medium

## Context

Partly a sub-task of open issue "Accessibility Pass". This draft is narrowed to table semantics and scroll only.

The five data tables in `src/App.tsx` render bare `<table>`/`<th>` markup with no `<caption>`, no `scope` on header cells, and no exposed sort state. Only some headers are sortable buttons (lines 1226–1249); the sorted column is not exposed via `aria-sort`. On small viewports each table is forced to `min-width: 880px` in `src/index.css` (the `.table-wrap table` rule at lines 1051–1053) inside `.table-wrap { overflow-x: auto }` (lines 405–407), but the five table-wrap `<div>` elements (lines 1222, 1398, 1487, 1600, 1652) have no `tabindex`, `role`, or accessible name, so keyboard-only users cannot scroll a table horizontally. Affected: screen-reader and keyboard-only users across all five tables.

## Acceptance criteria

- Each of the five `<table>` elements renders exactly one `<caption>` and every `<th>` has `scope="col"`.
- Clicking the `AMOUNT` `.sort-button` sets `aria-sort="ascending"` on that `<th>` and `aria-sort="none"` on the other three sortable `<th>`s; clicking it again sets `aria-sort="descending"`.
- At a 360px viewport, each `.table-wrap` has `tabindex="0"`, `role="region"`, a unique `aria-label`, `scrollWidth > clientWidth`, and a non-`none` computed `outline-style` when focused.
- The transparency row order and `filteredAid.length` are identical before and after the change.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` exit with code 0.

## Files to touch

- `src/App.tsx`
- `src/index.css`
- `docs/manual-test-checklist.md`

## Test expectations

- Manual: run `npm run dev`, narrow the viewport to 360px, Tab to a table region, confirm a focus ring, and scroll with arrow keys. In a screen reader, confirm each table's caption and column headers are announced and sort direction is reported.
- Run: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`

## Out of scope

Replacing tables with card layouts, virtualized rows, cursor-pagination controls, or changing the records API.

## Depends on

None
