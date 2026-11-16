# Guard the CSV Export Against Spreadsheet Formula Injection

**Complexity:** medium

## Context

Partly extends the CSV export covered by open issue "CSV Export Tests". This draft is narrowed to injection neutralization and its tests; it does not duplicate existing happy-path test coverage.

`exportCsv` in `src/App.tsx` escapes only double quotes before writing values (the `escape` helper at line 898, within lines 885–911). Columns include user-controlled fields — `recipient`, `purpose`, `organization` (lines 886–897) — so a value beginning with `=`, `+`, `-`, or `@` becomes a live formula when the file is opened in Excel, LibreOffice, or Google Sheets. A purpose such as `=HYPERLINK("http://evil","click")` or `=cmd|'/c calc'!A0` executes on open. Affected: anyone who exports the ledger and opens it in a spreadsheet.

## Acceptance criteria

- A record whose purpose is `=1+1` exports as a string that a spreadsheet renders literally (leading character neutralized), not as the value `2`.
- Values containing `"`, commas, and newlines remain correctly quoted.
- A unit test covers `=`, `+`, `-`, `@`, embedded quotes, commas, newlines, and an empty value.
- `npm test -- tests/csv.test.ts` and `npm run typecheck` pass.

## Files to touch

- `src/App.tsx` (or a new `src/csv.ts` if the escaping is extracted)
- `tests/csv.test.ts` (new)

## Test expectations

- Run: `npm test -- tests/csv.test.ts`
- Run: `npm run typecheck`
- Manual: run `npm run dev`, create a record with purpose starting with `=`, export, and open in a spreadsheet to confirm it is treated as text.

## Out of scope

Changing the export scope, adding new export formats, and the UTF-8 BOM draft.

## Depends on

None
