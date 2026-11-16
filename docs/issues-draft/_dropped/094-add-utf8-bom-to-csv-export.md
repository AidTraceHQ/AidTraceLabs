# Add a UTF-8 BOM to the Exported CSV So Excel Renders Non-ASCII Text Correctly

> **Status:** Dropped - merged into #12

**Complexity:** trivial

## Context

`exportCsv` in `src/App.tsx` builds the CSV from a string and creates the blob with `type: 'text/csv;charset=utf-8'` but writes no byte-order mark (line 905). Microsoft Excel on Windows often ignores the MIME charset for CSV files opened by double-click and assumes the system ANSI code page, so recipient and organization names containing non-ASCII characters render as mojibake. Affected: users who export and open the ledger in desktop Excel. Current behavior: no BOM is prepended; non-ASCII characters may render incorrectly in Excel. Expected behavior: the UTF-8 BOM (`\uFEFF`) is prepended to the CSV string before creating the blob.

## Acceptance criteria

- The produced export string starts with `\uFEFF` followed by the header row.
- Opening the file in Excel shows non-ASCII names correctly (manual check with a name such as `München` or `Ω`).
- `npm run typecheck` and `npm test` pass.

## Files to touch

- `src/App.tsx` (or `src/csv.ts` if the export is extracted)

## Test expectations

- Manual: run `npm run dev`, export the ledger, open the file in a spreadsheet, and verify non-ASCII names.
- Run: `npm run typecheck`
- Run: `npm test`

## Out of scope

Changing the export format, adding new columns, and locale-specific number formatting.

## Depends on

Guard the CSV export against spreadsheet formula injection
