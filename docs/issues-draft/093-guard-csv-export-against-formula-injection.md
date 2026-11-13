<!-- OVERLAP: Adds formula-injection safety to the same CSV export code covered by open issue #12 "CSV Export Tests". Narrowed to injection neutralisation and its tests; does not duplicate the existing happy-path test coverage. -->

# Guard the CSV export against spreadsheet formula injection

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 3

## Problem statement

`exportCsv` escapes only double quotes before writing values into the file (`src/App.tsx:885-911`,
especially the `escape` helper at `src/App.tsx:898`). Columns include user-controlled fields —
`recipient`, `purpose`, `organization` (`src/App.tsx:886-897`) — so a value beginning with `=`, `+`,
`-`, or `@` becomes a live formula when the file is opened in Excel, LibreOffice, or Google Sheets
(CSV injection / formula injection). A purpose such as `=HYPERLINK("http://evil","click")` or
`=cmd|'/c calc'!A0` executes on open. Affected: anyone who exports the ledger and opens it in a
spreadsheet. This is a data-safety and security gap, and remediation must not weaken any existing
rule.

## Technical implementation requirements

- Neutralise leading formula triggers: when a field's first character is one of `= + - @`, or a tab /
  carriage return that a spreadsheet may strip, prefix the value with a single quote (`'`) or an
  equivalent documented neutraliser, **inside** the RFC-4180 quoting.
- Keep the existing quote escaping for embedded `"`.
- Apply the neutraliser to every string column, not just the three named above, so future columns are
  covered.
- Keep CRLF line endings and the current `text/csv;charset=utf-8` blob type.
- Do not change which records are exported or the column set.

## Files and areas to touch

- `src/App.tsx` (or a new `src/csv.ts` if the escaping is extracted)
- `tests/csv.test.ts` (new)

## Dependencies

- None. Existing GitHub issue #12 covers CSV export **test coverage** for the current happy path; this adds
  the missing safety behaviour and its tests.

## Measurable acceptance criteria

- A record whose purpose is `=1+1` exports as a string that a spreadsheet renders literally (leading
  character neutralised), not as the value `2`.
- Values containing `"`, commas, and newlines remain correctly quoted.
- A unit test covers `=`, `+`, `-`, `@`, embedded quotes, commas, newlines, and an empty value.
- `npm test -- tests/csv.test.ts` and `npm run typecheck` pass.

## Expected deliverables

- A neutralising CSV escape path, extracted for testability, plus unit tests.

## How to set up and run tests

- Run `npm test -- tests/csv.test.ts`.
- Run `npm run dev`, create a record whose purpose starts with `=`, export, and open the file in a
  spreadsheet to confirm it is treated as text.

## Out of scope

- Changing the export scope, adding new export formats, and the UTF-8 BOM draft.

## Suggested labels

- `area: frontend`, `area: security`, `type: bug`, `difficulty: medium`
