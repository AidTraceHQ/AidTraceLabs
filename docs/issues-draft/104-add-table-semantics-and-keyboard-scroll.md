<!-- OVERLAP: Sub-task of open issue #23 "Accessibility Pass". Narrowed to table semantics and scroll only. -->

# Add Table Semantics and Keyboard Scrolling to the Data Tables

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 8 hours

**Release day:** Day 1

## Problem statement

The five data tables render bare `<table>`/`<th>` markup with no `<caption>`, no `scope` on header
cells, and no exposed sort state. Only some headers are sortable buttons (`src/App.tsx:1226-1249`, the
transparency table's `<thead>` `<tr>` whose `RECIPIENT`/`PURPOSE`/`AMOUNT`/`DATE` cells contain
`.sort-button`s),
and the sorted column is not exposed via `aria-sort`, so a screen reader cannot tell which column is
sorted or in which direction. On small viewports each table is forced to `min-width: 880px`
(`src/index.css:1051-1053`, the `.table-wrap table` rule) inside `.table-wrap { overflow-x: auto }`
(`src/index.css:405-407`), but
the wrappers (`src/App.tsx:1222`, `1398`, `1487`, `1600`, `1652`, the five
`<div className="table-wrap">` elements for transparency, activity, beneficiary, roles, and audit)
have no `tabindex`, `role`, or
accessible name, so keyboard-only users cannot scroll a table horizontally. Screen-reader and
keyboard-only mobile users are affected across the transparency, activity, beneficiary, roles, and
audit tables.

## Technical implementation requirements

- Add a short `<caption>` (visually hidden if needed) to each of the five tables.
- Add `scope="col"` to every header cell in all five tables.
- On the four sortable headers, expose `aria-sort="ascending" | "descending"` (and `"none"` for
  inactive sortable columns) driven by the existing `sortBy`/`sortDir` state
  (`src/App.tsx:222-223`) and the `sortRecords()` function (`src/App.tsx:878-884`).
- Make each `.table-wrap` focusable (`tabindex="0"`) with `role="region"` and a unique `aria-label`,
  and add a visible focus style so keyboard users can scroll it.
- Preserve the current sorting, filtering, pagination, and column text; do not change the API or the
  returned data.

## Files and areas to touch

- `src/App.tsx`
- `src/index.css`
- `docs/manual-test-checklist.md`

## Dependencies

- None.

## Measurable acceptance criteria

- Each of the five `<table>` elements renders exactly one `<caption>` and every `<th>` has
  `scope="col"`.
- Clicking the `AMOUNT` `.sort-button` sets `aria-sort="ascending"` on that `<th>` and
  `aria-sort="none"` on the other three sortable `<th>`s; clicking it again sets
  `aria-sort="descending"`.
- At a 360px viewport, each `.table-wrap` has `tabindex="0"`, `role="region"`, a unique `aria-label`,
  `scrollWidth > clientWidth`, and a non-`none` computed `outline-style` when focused.
- The transparency row order and `filteredAid.length` are identical before and after the change
  (asserted by the existing suite).
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` exit with code 0.

## Expected deliverables

- Updated table markup, scroll-wrapper focus styles, and manual checklist steps for table keyboard use.

## How to set up and run tests

- Run `npm run dev`, narrow the viewport to 360px, Tab to a table region, confirm a focus ring, and
  scroll it with the arrow keys.
- In a screen reader, confirm each table's caption and column headers are announced and that sorting
  a column reports the new sort direction.
- Run `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`.

## Out of scope

- Replacing tables with card layouts, virtualized rows, cursor-pagination controls, or changing the
  records API.

## Suggested labels

- `area: accessibility`, `type: enhancement`, `difficulty: medium`.
