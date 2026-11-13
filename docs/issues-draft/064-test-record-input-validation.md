# Test Record Input Validation and Amount Bounds

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 8 hours

**Release day:** Day 3

## Problem statement

`validateRecord` and `amountToStroops` are exported (`server/records.ts:1328`) and enforce address, asset, amount, date, and consent rules (`server/records.ts:139-180`; `server/records.ts:108-118`), but no test imports them (confirmed: no matches in `tests/`). The integration suite only creates valid records, so a regression in the reject rules — allowing a zero or overflowing amount, `XLM` with an issuer, or a non-native asset without an issuer — would not fail the suite. Affected: downstream consumers who trust the stored record invariants.

## Technical implementation requirements

- Add unit tests asserting `validateRecord` returns `null` for: invalid recipient address, empty recipient/purpose, zero amount, more than seven decimals, an amount above the stroops bound (`server/records.ts:114`), `XLM` with an issuer, a non-`XLM` asset without an issuer, invalid network/date, a malformed `txHash`, and a non-boolean `recipientConsent`.
- Add positive cases for a valid `XLM` record, a valid issued-asset record, and an empty/omitted issuer.
- Do NOT change validation rules, error messages, or the route contract.

## Files and areas to touch

- A `tests/` unit file (for example `tests/records-validation.test.ts`)

## Dependencies

- None (pure unit tests; no database).

## Measurable acceptance criteria

- Each listed invalid input returns `null`; valid inputs return a normalized object.
- `amountToStroops` rejects `0`, `-1`, `1.12345678`, and `92233720368548` while accepting `1.25`.
- `npm test` passes; `npm run typecheck` passes.

## Expected deliverables

- Unit tests covering the validation matrix.

## How to set up and run tests

- No database needed; run `npm test` (or the new file) and `npm run typecheck`.

## Out of scope

- Adding asset registries, changing limits, or adding new validation features.

## Suggested labels

- `area: security`, `area: testing`, `type: enhancement`, `difficulty: medium`.
