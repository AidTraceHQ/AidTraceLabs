# Apply One Transient Retry to Remaining Safe Read Routes

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 2

## Problem statement

`retryReadOnlyDatabase` retries one transient failure for the wrapped `GET /api/transparency` handler (`server/records.ts:763-766`), but the `GET /api/beneficiary` handler (`server/records.ts:766`), `GET /api/admin/roles` (`server/records.ts:1082`), and `GET /api/audit` (`server/records.ts:1228`) are not wrapped. These reads return a 503 on a transient connection reset even though a read-only retry is safe.

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

- For each of `GET /api/beneficiary`, `GET /api/admin/roles`, and `GET /api/audit`, a mocked test asserts exactly two database attempts (`pool.query` called twice) on a transient error and a `503` body `{ "error": "database_unavailable" }` when the retry also fails.
- A mocked test asserts a non-transient error results in exactly one database attempt (no retry).
- Write routes remain un-retried: the existing `POST /api/records` tests still pass unchanged.
- `npm test -- tests/database-errors.test.ts tests/backend.test.ts` passes.

## Expected deliverables

- Route wrapper integration and mocked transient/non-transient retry tests.

## How to set up and run tests

- To skip database integration locally, set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty in the shell, then run `npm test -- tests/database-errors.test.ts tests/backend.test.ts`.
- Run database-backed authorization tests only against the dedicated test database configured in `CONTRIBUTING.md`.

## Out of scope

- Retrying mutations, adding a shared retry library, or changing the transient error set.

## Suggested labels

- `area: backend`, `type: enhancement`, `difficulty: medium`.
