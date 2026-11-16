# Broaden Transient Database Error Classification

**Complexity:** medium

## Context

`isTransientDatabaseError` in `server/database-errors.ts` (line 8 and lines 14–28) only treats `EAI_AGAIN`, `ECONNRESET`, `ETIMEDOUT`, and the message `Connection terminated unexpectedly` (including nested `cause`) as transient. Common transient conditions are missing: socket errors `ECONNREFUSED`/`EPIPE`, PostgreSQL connection-exception SQLSTATE class `08*`, admin shutdown `57P01`, and too-many-connections `53300`. When these occur, `retryReadOnlyDatabase` (lines 40–56) does not retry and `databaseUnavailableResponse` (lines 58–66) returns null, so the request falls through to the generic 500 branch instead of a retried, sanitized 503. Affected: clients during a database restart or brief saturation. Must not classify constraint violations (`23505`, `23503`, `23514`) as transient.

## Acceptance criteria

- Unit tests assert each newly added code/SQLSTATE class is classified transient and that `23505`, `23503`, and `23514` are not.
- The existing test that expects exactly two attempts and a sanitized 503 response still passes.
- `npm test -- tests/database-errors.test.ts` passes and `npm run typecheck` passes.

## Files to touch

- `server/database-errors.ts`
- `tests/database-errors.test.ts`

## Test expectations

- Run: `npm test -- tests/database-errors.test.ts` (no database required)
- Run: `npm run typecheck`

## Out of scope

Changing the 503 message, adding backoff, or retrying write transactions.

## Depends on

None
