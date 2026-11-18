# Export a Beneficiary's Own Records as CSV

**Complexity:** intermediate

## Context

> **Overlap note:** Uses the same CSV builder as the transparency export covered by open issue "CSV Export Tests". Narrowed: beneficiary-only export control using the shared builder; no duplicate test infrastructure.

The beneficiary view in `src/App.tsx` (table at lines 1487Ã¢â‚¬â€œ1530) lists records addressed to the session wallet with only a Refresh control (lines 1479Ã¢â‚¬â€œ1485). There is no way for a beneficiary to download their own records; the only export is on the public transparency page (button at lines 1093Ã¢â‚¬â€œ1100) and it exports the full ledger. Affected: beneficiaries who need a personal record of what they received.

## Acceptance criteria

- A beneficiary can export a CSV containing exactly the rows shown in their table, with the same columns as the table.
- No field outside the beneficiary projection appears in the file.
- The control is disabled with an empty list.
- `npm run typecheck` and `npm test` pass.

## Files to touch

- `src/App.tsx`
- `tests/csv.test.ts` (if a builder is extracted)

## Test expectations

- Manual: run `npm run dev`, connect a beneficiary wallet that has records, export, and compare with the table; confirm no extra fields are present.
- Run: `npm run typecheck`
- Run: `npm test`

## Out of scope

Changing the beneficiary query, adding receipt/PDF output (tracked by a separate open issue), and exporting other wallets' records.

## Depends on

Guard the CSV export against spreadsheet formula injection
