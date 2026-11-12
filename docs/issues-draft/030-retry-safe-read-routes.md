# Apply One Transient Retry to Remaining Safe Read Routes

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 12 hours

**Release day:** Day 2

## Problem statement

`retryReadOnlyDatabase` retries one transient failure for selected GET routes, but `/api/beneficiary`, `/api/admin/roles`, and `/api/audit` are not wrapped (`server/records.ts:763-766,1082,1228`). These reads return a 503 on a transient connection reset even though a read-only retry is safe.

## Technical implementation requirements

- Reuse the existing one-retry helper for the remaining database-backed GET handlers.
- Keep retry eligibility limited to the existing transient error classifier and exactly one retry.
- Preserve route-specific authorization, response headers, status mapping, and safe logs.
- Do not wrap POST/PUT/DELETE routes or retry any write transaction.

## Files and areas to touch

- `server/records.ts`
- `tests/database-errors.test.ts`
- `tests/backend.test.ts`

## Dependencies

- None.

## Measurable acceptance criteria

- Each targeted GET retries once for an approved transient database error and returns a sanitized 503 if the retry fails.
- Non-transient errors are not retried.
- Write routes are not retried.
- Authorization and pagination behavior is unchanged.

## Expected deliverables

- Route wrapper integration and mocked transient/non-transient retry tests.

## How to set up and run tests

- To skip database integration locally, set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty in the shell, then run `npm test -- tests/database-errors.test.ts tests/backend.test.ts`.
- Run database-backed authorization tests only against the dedicated test database configured in `CONTRIBUTING.md`.

## Out of scope

- Retrying mutations, adding a shared retry library, or changing the transient error set.

## Suggested labels

- `area: backend`, `type: enhancement`, `difficulty: high`.
