# Preserve the Original Error When Transaction Rollback Fails

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 3

## Problem statement

`withTransaction` (`server/db.ts:31-44`) awaits `ROLLBACK` inside the catch block. If rollback itself fails because the connection was lost, that second error replaces the original query/commit error, obscuring the event that caused the transaction to fail.

## Technical implementation requirements

- Preserve the original operation error as the primary rejection.
- Retain rollback failure as a non-secret `cause` or secondary diagnostic without serializing SQL values or connection details.
- Always release the client in `finally` and do not claim the transaction was rolled back when rollback failed.

## Files and areas to touch

- `server/db.ts`
- `tests/database-errors.test.ts` or a focused transaction-helper test

## Dependencies

- None.

## Measurable acceptance criteria

- Test `preserves the work error as the primary rejection` in `tests/database-errors.test.ts` asserts the rejected error is the callback's original error object.
- Test `surfaces a rollback failure without claiming success` asserts the rejection is not a successful result and carries the rollback failure only as a non-secret `cause`.
- Test `releases the client exactly once` asserts the mocked `release` spy is called exactly once in the callback-failure-plus-rollback-failure case.
- `npx vitest run tests/database-errors.test.ts` passes.

## Expected deliverables

- Transaction error-preservation change and focused mocked-client tests.

## How to set up and run tests

- Run `npx vitest run tests/database-errors.test.ts` and `npm run typecheck`.

## Out of scope

- Retrying transactions, changing isolation levels, or altering database error classification.

## Suggested labels

- `area: backend`, `type: bug`, `difficulty: medium`.
