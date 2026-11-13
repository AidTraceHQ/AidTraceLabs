# Add a UTF-8 BOM to the exported CSV so Excel renders non-ASCII text correctly

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 2 hours

**Release day:** Day 5

## Problem statement

`exportCsv` builds the file from a string and creates the blob with `type:
'text/csv;charset=utf-8'` but writes no byte-order mark (`src/App.tsx:905`). Microsoft Excel on
Windows often ignores the MIME charset for CSV files opened by double-click and assumes the system
ANSI code page, so recipient and organization names containing non-ASCII characters render as
mojibake. Affected: users who export and open the ledger in desktop Excel.

## Technical implementation requirements

- Prepend the UTF-8 BOM (`\uFEFF`) to the CSV string before creating the blob.
- Keep the CRLF row separator and the existing `text/csv;charset=utf-8` type.
- Do not change the column set, escaping, or which rows are exported.

## Files and areas to touch

- `src/App.tsx` (or `src/csv.ts` if the export is extracted)

## Dependencies

- Shares the export code with the formula-injection guard; if that guard extracts a builder, add the
  BOM there. Either order is fine.

## Measurable acceptance criteria

- The produced export string starts with `\uFEFF` followed by the header row.
- Opening the file in Excel shows non-ASCII names correctly (manual check with a name such as
  `München`, `Ω`).
- `npm run typecheck` and `npm test` pass.

## Expected deliverables

- A BOM-prefixed CSV export (and a test asserting the leading BOM if a builder is extracted).

## How to set up and run tests

- Run `npm run dev`, export the ledger, open the file in a spreadsheet, and verify non-ASCII names.

## Out of scope

- Changing the export format, adding new columns, and locale-specific number formatting.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: trivial`
