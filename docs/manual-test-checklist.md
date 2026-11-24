# Manual Test Checklist

Use this checklist for accessibility work that automated checks cannot cover. Record the
browser, operating system, and screen reader you used.

## Data tables: semantics, sorting, and keyboard scrolling

Applies to all five data tables: transparency ledger, wallet activity, beneficiary records,
role assignments, and audit log events.

### Table semantics

1. Run `npm run dev` and open the app.
2. In a screen reader (for example NVDA with Firefox, or VoiceOver with Safari), navigate to
   each table by table navigation (for example `T` in NVDA browse mode).
3. Confirm the table is announced with its caption:
   - "Transparency ledger records"
   - "Wallet activity records"
   - "Beneficiary records"
   - "Role assignments"
   - "Audit log events"
4. Confirm each column header is announced with its column when moving between cells.

### Sort state

1. On the transparency ledger table, focus the AMOUNT header button and activate it.
2. Confirm `aria-sort="ascending"` is exposed for AMOUNT and `aria-sort="none"` for RECIPIENT,
   PURPOSE, and DATE (inspect the accessibility tree or the DOM).
3. Confirm the screen reader reports the sort direction for the AMOUNT column.
4. Activate AMOUNT again and confirm it becomes `aria-sort="descending"`.
5. Confirm the row order matches the selected direction and that the record count is unchanged.

### Keyboard scrolling at 360px

1. Narrow the viewport to 360px (or use the browser device toolbar).
2. Press `Tab` until focus enters a table region. Confirm a visible focus ring appears around
   the table container and that focus order continues into the table content afterwards.
3. With the region focused, use the arrow keys to scroll the table horizontally.
4. Repeat for each of the five tables, confirming each region has a distinct accessible name.
5. Turn on a screen reader and confirm the region is announced as a region with its label.
