# Centralize Database Error-to-Response Mapping

**Complexity:** medium

## Context

Unique-violation handling exists only as an ad-hoc `23505` check in `server/records.ts` (the `uniqueViolation` helper, line 611–613) used in exactly two catch blocks (at lines 838–844 and 997–1003). Every other database error reaches the generic 500 branch of `errorHandler` in `server/app.ts` (lines 47–52). Admin role writes can raise foreign-key (`23503`) or check (`23514`) violations, and no shared SQLSTATE-to-HTTP translation exists outside the transient 503 path in `server/database-errors.ts` (function `databaseUnavailableResponse`, lines 58–66). The error object's `status`/`statusCode` is never consulted (confirmed by searching `server/`). Affected: API clients and operators who receive 500 for determinable client errors.

## Acceptance criteria

- A test in `tests/backend.test.ts` that triggers a `23503` or `23514` on a write route observes a 4xx status (not 500) with a `{ "error": string }` body.
- The existing duplicate-hash assertion `'A record already exists for this network and transaction hash.'` still observes 409.
- The transient 503 path still returns exactly `{ "error": "database_unavailable" }`.
- `npm test -- tests/backend.test.ts` passes and `npm run typecheck` passes.

## Files to touch

- `server/records.ts`
- `server/database-errors.ts`
- `tests/backend.test.ts`

## Test expectations

- Configure: `TEST_DATABASE_URL`, `TEST_DATABASE_BRANCH=test`
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

New constraints, changes to the 503 mapping, retry behavior, or general request validation.

## Depends on

Enforce Hash and Asset-Issuer Invariants in PostgreSQL
