# Preserve the Original Error When Transaction Rollback Fails

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 3

## Problem statement

`withTransaction` awaits `ROLLBACK` inside the catch block (`server/db.ts:31-44`). If rollback itself fails because the connection was lost, that second error replaces the original query/commit error, obscuring the event that caused the transaction to fail.

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

- A work callback failure followed by rollback failure rejects with the original error as primary.
- A rollback failure after a successful callback/failed commit is surfaced without claiming success.
- The client release callback runs exactly once in all cases.

## Expected deliverables

- Transaction error-preservation change and focused mocked-client tests.

## How to set up and run tests

- Run `npx vitest run tests/database-errors.test.ts` and `npm run typecheck`.

## Out of scope

- Retrying transactions, changing isolation levels, or altering database error classification.

## Suggested labels

- `area: backend`, `type: bug`, `difficulty: medium`.
