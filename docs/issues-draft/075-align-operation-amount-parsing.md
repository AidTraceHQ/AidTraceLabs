# Align and Bound Operation-Amount Parsing With Record Amounts

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 3

## Problem statement

Record amounts are parsed by `amountToStroops`, which rejects zero/negative values and anything above the BIGINT bound (`server/records.ts:108-118`). Horizon operation amounts are parsed by a separate `toStroops`, which reuses the seven-decimal pattern (`server/stellar-verification.ts:40`) but applies no positive or upper bound and silently returns `null` for any value that does not match (`server/stellar-verification.ts:60-72`). In the matching loop a `null` amount simply fails the `amount === expectedAmount` comparison and is reported as the generic "Amount differs from the recorded amount." (`server/stellar-verification.ts:311-315`, `server/stellar-verification.ts:363`), so a malformed or over-precision operation amount is indistinguishable from a genuine amount mismatch. Affected: reviewers who cannot tell a data-quality problem apart from a real discrepancy.

## Technical implementation requirements

- Give operation-amount parsing the same explicit guarantees as record-amount parsing (non-negative, bounded, at most seven decimals) so the two paths agree.
- When an eligible operation's amount cannot be parsed, record a distinct, user-safe difference (for example an unreadable-amount note) instead of the generic amount-mismatch text, without changing any `verified` outcome or status value.
- Do NOT alter the matching fields, the `verified` rule, or the record-validation rules owned by draft "Test Record Input Validation and Amount Bounds".
- Add coverage for a valid amount, an over-precision amount, and a zero/negative amount.

## Files and areas to touch

- `server/stellar-verification.ts`
- `tests/backend.test.ts`

## Dependencies

- None. Boundary with "Test Record Input Validation and Amount Bounds": "Test Record Input Validation and Amount Bounds" tests the record-side `validateRecord`/`amountToStroops`; this issue covers the operation-side parser and its mismatch reporting.

## Measurable acceptance criteria

- The operation-side parser and the record-side `amountToStroops` agree on valid, zero, negative, over-precision, and over-bound inputs.
- An unparseable operation amount produces a distinct difference string and never yields `verified`.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.

## Expected deliverables

- An aligned operation-amount parser and distinct unreadable-amount reporting, with unit and integration coverage.

## How to set up and run tests

- To skip database integration locally, set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty in the shell, then run `npm test -- tests/backend.test.ts`; the Horizon tests use a mocked `fetch`.
- Run `npm run typecheck`.

## Out of scope

- Changing record validation, the eligible operation set, or the `verified` rule.

## Suggested labels

- `area: backend`, `type: bug`, `difficulty: medium`.
