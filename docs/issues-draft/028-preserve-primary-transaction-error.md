# Preserve the Original Error When Transaction Rollback Fails

**Complexity:** intermediate

## Context

`withTransaction` in `server/db.ts` (function `withTransaction`, lines 31Ã¢â‚¬â€œ44) awaits `ROLLBACK` inside the catch block. If the rollback itself fails because the connection was lost, the rollback error replaces the original query/commit error. Maintainers see the rollback failure but not the root cause. Affected users: maintainers diagnosing transaction failures in production logs. Current behavior: a failed rollback replaces the primary error with the rollback error. Expected behavior: the original operation error is the primary rejection; the rollback failure is retained as a non-secret `cause` or secondary diagnostic without serializing SQL values or connection details. The client is always released in `finally`. Evidence: `server/db.ts` (function `withTransaction`, lines 31Ã¢â‚¬â€œ44).

## Acceptance criteria

- Test `preserves the work error as the primary rejection` in `tests/database-errors.test.ts` asserts the rejected error is the callback's original error object.
- Test `surfaces a rollback failure without claiming success` asserts the rejection is not a successful result and carries the rollback failure only as a non-secret `cause`.
- Test `releases the client exactly once` asserts the mocked `release` spy is called exactly once in the callback-failure-plus-rollback-failure case.
- `npx vitest run tests/database-errors.test.ts` passes.

## Files to touch

- `server/db.ts`
- `tests/database-errors.test.ts` (or a focused transaction-helper test)

## Test expectations

- Run: `npx vitest run tests/database-errors.test.ts`
- Run: `npm run typecheck`
- No live database required (mocked client tests).

## Out of scope

Retrying transactions, changing isolation levels, or altering database error classification.

## Depends on

None
