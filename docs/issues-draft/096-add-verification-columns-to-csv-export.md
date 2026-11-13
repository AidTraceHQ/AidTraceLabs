<!-- OVERLAP: Extends the CSV export covered by open issue #12 "CSV Export Tests". Narrowed to adding verification columns only; does not change existing columns or test infrastructure. -->

# Include verification status, reason and last-checked time in the CSV export

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 4

## Problem statement

The CSV export columns omit the verification fields that the client already holds. `exportCsv`
writes `recipient, recipientAddress, purpose, amount, asset, network, txHash, date, organization,
status` (`src/App.tsx:886-897`), while the record model also carries verification detail
(`src/App.tsx:44-55`) that the ledger renders, including a mismatch reason. An auditor who exports the
ledger therefore cannot see _why_ a record is a mismatch or when it was last checked, and must go
back to the UI for each row. Affected: anyone producing a downloadable record of aid disbursements.

## Technical implementation requirements

- Add columns for the verification reason/differences and the last-checked timestamp, using the
  fields already present on the client model (`src/App.tsx:44-55`).
- Keep existing columns and their order; append the new columns.
- Escape the new values with the same escaper used for the rest of the export.
- Do not change which records are exported, the server response, or the verification algorithm.

## Files and areas to touch

- `src/App.tsx`
- `tests/csv.test.ts` (if a builder is extracted)

## Dependencies

- Shares the export code with the formula-injection and BOM drafts; coordinate the escaper.

## Measurable acceptance criteria

- The exported file contains the new columns populated for verified, mismatch, not-found, and
  unverified records; empty when absent.
- Existing columns and their values are unchanged.
- `npm run typecheck` and `npm test` pass.

## Expected deliverables

- Extended CSV columns plus a formatting test.

## How to set up and run tests

- Run `npm run dev`, export the ledger, and confirm a mismatch row shows its reason and check time in
  the file.

## Out of scope

- Adding verification fields to the API response, changing the verification logic, and a PDF/receipt
  format.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: medium`
