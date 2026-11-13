# Broaden Transient Database Error Classification

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 1

## Problem statement

`isTransientDatabaseError` only treats `EAI_AGAIN`, `ECONNRESET`, `ETIMEDOUT`, and the message `Connection terminated unexpectedly` (including nested `cause`) as transient (`server/database-errors.ts:8`, `server/database-errors.ts:14-28`). Common transient conditions are missing: socket errors such as `ECONNREFUSED`/`EPIPE`, PostgreSQL connection-exception SQLSTATE class `08*`, admin shutdown `57P01`, and too-many-connections `53300`. When one of these occurs, `retryReadOnlyDatabase` does not retry (`server/database-errors.ts:40-56`) and `databaseUnavailableResponse` returns null (`server/database-errors.ts:58-66`), so the request falls through to the generic 500 branch (`server/app.ts:47-52`) instead of a retried, sanitized 503. Affected: clients during a database restart or brief saturation.

## Technical implementation requirements

- Extend the classifier so `ECONNREFUSED`, `EPIPE`, SQLSTATE class `08*`, `57P01`, and `53300` are treated as transient, by adding codes and/or a SQLSTATE-prefix check.
- Keep the existing codes, the nested-`cause` recursion, and `DatabaseUnavailableError` behavior.
- Do NOT change which routes opt into the retry wrapper (that is tracked separately).
- Do NOT change the 503 body shape (`{ "error": "database_unavailable" }`).
- Do NOT classify constraint violations (`23505`, `23503`, `23514`) as transient.

## Files and areas to touch

- `server/database-errors.ts`
- `tests/database-errors.test.ts`

## Dependencies

- Complementary to the safe-read-route retry draft: this only widens the classifier. Distinct from the database-readiness endpoint draft.

## Measurable acceptance criteria

- Unit tests assert each newly added code/SQLSTATE class is classified transient and that `23505`, `23503`, and `23514` are not.
- The existing test that expects exactly two attempts and a sanitized 503 response still passes.
- `npm test -- tests/database-errors.test.ts` passes and `npm run typecheck` passes.

## Expected deliverables

- Classifier update with unit tests for new and preserved cases.

## How to set up and run tests

- `npm test -- tests/database-errors.test.ts` runs without a database.
- Run `npm run typecheck`.

## Out of scope

- Changing the 503 message, adding backoff, or retrying write transactions.

## Suggested labels

- `area: backend`, `type: bug`, `difficulty: medium`
