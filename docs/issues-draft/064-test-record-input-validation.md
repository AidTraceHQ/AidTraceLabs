# Test Record Input Validation and Amount Bounds

**Complexity:** intermediate

## Context

`validateRecord` and `amountToStroops` are exported from `server/records.ts` (line 1328) and enforce address, asset, amount, date, and consent rules (functions `validateRecord` at lines 139Ã¢â‚¬â€œ180 and `amountToStroops` at lines 108Ã¢â‚¬â€œ118). No test imports them (confirmed by searching `tests/`). The integration suite only creates valid records, so a regression in the reject rules Ã¢â‚¬â€ allowing zero or overflowing amounts, `XLM` with an issuer, or a non-native asset without an issuer Ã¢â‚¬â€ would not fail the suite. Affected: downstream consumers who trust stored record invariants.

## Acceptance criteria

- Unit tests assert `validateRecord` returns `null` for: invalid recipient address, empty recipient/purpose, zero amount, more than seven decimals, an amount above the stroops bound, `XLM` with an issuer, a non-`XLM` asset without an issuer, invalid network/date, a malformed `txHash`, and a non-boolean `recipientConsent`.
- Positive cases for a valid `XLM` record, a valid issued-asset record, and an empty/omitted issuer pass.
- `amountToStroops` rejects `0`, `-1`, `1.12345678`, and `92233720368548` while accepting `1.25`.
- `npm test` passes; `npm run typecheck` passes.

## Files to touch

- `tests/records-validation.test.ts` (new unit test file)

## Test expectations

- No database needed.
- Run: `npm test` (or the new file directly)
- Run: `npm run typecheck`

## Out of scope

Adding asset registries, changing limits, or adding new validation features.

## Depends on

None
