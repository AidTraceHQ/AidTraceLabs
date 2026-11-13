<!-- OVERLAP: Extends the CSV export covered by open issue #12 "CSV Export Tests". Narrowed to beneficiary-only export control; does not duplicate transparency export tests. -->

# Export a beneficiary's own records as CSV

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 4

## Problem statement

The beneficiary view lists the records addressed to the session wallet in a table
(`src/App.tsx:1487-1530`) with only a Refresh control (`src/App.tsx:1479-1485`). There is no way for a
beneficiary to download their own records; the only export is on the public transparency page
(`src/App.tsx:885-911`, button at `src/App.tsx:1093-1100`) and it exports the ledger, not the
beneficiary's rows. Affected: beneficiaries who need a personal record of what they received.

## Technical implementation requirements

- Add an export control to the beneficiary section that writes the records already loaded for the
  session wallet (`beneficiaryRecords`), using the same CSV builder and escaping as the ledger export.
- Keep the beneficiary projection exactly as returned by `/api/beneficiary` — do **not** add fields
  the view withholds, and do not broaden the query beyond the session wallet.
- Disable the control when there are no rows.
- Do not change the beneficiary API route or its authorization.

## Files and areas to touch

- `src/App.tsx`
- `tests/csv.test.ts` (if a builder is extracted)

## Dependencies

- The formula-injection guard draft should land first or together so the shared escaper is safe.

## Measurable acceptance criteria

- A beneficiary can export a CSV containing exactly the rows shown in their table, with the same
  columns as the table.
- No field outside the beneficiary projection appears in the file.
- The control is disabled with an empty list.
- `npm run typecheck` and `npm test` pass.

## How to set up and run tests

- Run `npm run dev`, connect a beneficiary wallet that has records, export, and compare with the
  table; confirm no extra fields are present.

## Out of scope

- Changing the beneficiary query, adding receipt/PDF output (existing GitHub issue #14), and exporting other wallets'
  records.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: medium`
