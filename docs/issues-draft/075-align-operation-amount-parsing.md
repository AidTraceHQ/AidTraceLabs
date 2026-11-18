# Align and Bound Operation-Amount Parsing With Record Amounts

**Complexity:** intermediate

## Context

Record amounts are parsed by `amountToStroops` in `server/records.ts` (function `amountToStroops`, lines 108Ã¢â‚¬â€œ118), which rejects zero/negative values and anything above the BIGINT bound. Horizon operation amounts are parsed by a separate `toStroops` in `server/stellar-verification.ts` (lines 60Ã¢â‚¬â€œ72), which reuses the seven-decimal pattern (line 40) but applies no positive or upper bound and silently returns `null` for any non-matching value. In the matching loop a `null` amount fails the `amount === expectedAmount` comparison and is reported as the generic "Amount differs from the recorded amount." (lines 311Ã¢â‚¬â€œ315 and 363). An unparseable operation amount is indistinguishable from a genuine mismatch. Affected: reviewers who cannot tell a data-quality problem apart from a real discrepancy.

## Acceptance criteria

- The operation-side parser and the record-side `amountToStroops` agree on valid, zero, negative, over-precision, and over-bound inputs.
- An unparseable operation amount produces a distinct difference string and never yields `verified`.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.

## Files to touch

- `server/stellar-verification.ts`
- `tests/backend.test.ts`

## Test expectations

- Set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty; Horizon tests use mocked `fetch`.
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Changing record validation, the eligible operation set, or the `verified` rule. Record-side validation is tracked by "Test Record Input Validation and Amount Bounds".

## Depends on

None
