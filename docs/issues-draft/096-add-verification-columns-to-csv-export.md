# Include Verification Status, Reason, and Last-Checked Time in the CSV Export

**Complexity:** medium

## Context

Partly extends the CSV export covered by open issue "CSV Export Tests". This draft is narrowed to adding verification columns only; it does not change existing columns or test infrastructure.

The CSV export columns in `src/App.tsx` (function `exportCsv`, lines 886–897) omit the verification fields that the client already holds. The record model carries verification detail (lines 44–55) that the ledger renders, including a mismatch reason. An auditor who exports the ledger cannot see why a record is a mismatch or when it was last checked. Affected: anyone producing a downloadable record of aid disbursements who needs verification detail.

## Acceptance criteria

- The exported file contains new columns for verification reason/differences and the last-checked timestamp, populated for verified, mismatch, not-found, and unverified records; empty when absent.
- Existing columns and their values are unchanged.
- New values are escaped with the same escaper used for the rest of the export.
- `npm run typecheck` and `npm test` pass.

## Files to touch

- `src/App.tsx`
- `tests/csv.test.ts` (if a builder is extracted)

## Test expectations

- Manual: run `npm run dev`, export the ledger, and confirm a mismatch row shows its reason and check time in the file.
- Run: `npm run typecheck`
- Run: `npm test`

## Out of scope

Adding verification fields to the API response, changing the verification logic, and a PDF/receipt format.

## Depends on

Guard the CSV export against spreadsheet formula injection
