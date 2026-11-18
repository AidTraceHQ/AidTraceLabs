# Apply One Transient Retry to Remaining Safe Read Routes

**Complexity:** intermediate

## Context

`retryReadOnlyDatabase` retries one transient failure for the wrapped `GET /api/transparency` handler in `server/records.ts` (function `retryReadOnlyDatabase`, lines 763Ã¢â‚¬â€œ766). The `GET /api/beneficiary` handler (line 766), `GET /api/admin/roles` (line 1082), and `GET /api/audit` (line 1228) are not wrapped. These reads return a 503 on a transient connection reset even though a read-only retry is safe. Affected users: clients who receive unnecessary 503 errors during brief database restarts. Current behavior: only the transparency route is wrapped in the retry helper; the other three safe reads fail without retry. Expected behavior: the existing one-retry helper is applied to the remaining database-backed GET handlers; write routes are never retried.

## Acceptance criteria

- For each of `GET /api/beneficiary`, `GET /api/admin/roles`, and `GET /api/audit`, a mocked test asserts exactly two database attempts (`pool.query` called twice) on a transient error and a `503` body `{ "error": "database_unavailable" }` when the retry also fails.
- A mocked test asserts a non-transient error results in exactly one database attempt (no retry).
- Write routes remain un-retried: existing `POST /api/records` tests pass unchanged.
- `npm test -- tests/database-errors.test.ts tests/backend.test.ts` passes.

## Files to touch

- `server/records.ts`
- `tests/database-errors.test.ts`
- `tests/backend.test.ts`

## Test expectations

- To skip database integration locally, set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty, then run `npm test -- tests/database-errors.test.ts tests/backend.test.ts`.
- Run database-backed authorization tests only against the dedicated test database configured in `CONTRIBUTING.md`.

## Out of scope

Retrying mutations, adding a shared retry library, or changing the transient error set.

## Depends on

None
