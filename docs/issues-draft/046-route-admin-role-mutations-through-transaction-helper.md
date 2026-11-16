# Route Admin Role Mutations Through the Shared Transaction Helper

**Complexity:** medium

## Context

The two admin role mutation handlers in `server/records.ts` open a pooled client and hand-roll the transaction instead of using the shared `withTransaction` helper. `POST /api/admin/roles` (lines 1144–1177) calls `pool.connect()`, `BEGIN`, `COMMIT`, and a `catch` that awaits `ROLLBACK` and rethrows. `DELETE /api/admin/roles/:address` (lines 1195–1224) does the same but additionally rolls back manually inside the `try` before its 404 response (lines 1204–1208). This duplicates `withTransaction` from `server/db.ts` (function `withTransaction`, lines 31–44) and gives the two routes divergent rollback paths. A fix to the shared helper will not reach these handlers. Affected: maintainers and any future transaction-handling change.

## Acceptance criteria

- `server/records.ts` no longer contains direct `pool.connect()`, `client.query('BEGIN')`, or `client.query('COMMIT')` calls in the two admin role handlers.
- Assigning, changing, and removing a role still return `{ ok: true }`; removing a non-existent explicit role still returns 404 `{ "error": "Explicit role not found." }`.
- `npm test -- tests/backend.test.ts` passes and `npm run typecheck` passes.

## Files to touch

- `server/records.ts`
- `tests/backend.test.ts`

## Test expectations

- Configure: `TEST_DATABASE_URL`, `TEST_DATABASE_BRANCH=test`
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Last-remaining-admin protection, role policy changes, audit filtering, or the rollback-masking fix (tracked by "Preserve the Original Error When Transaction Rollback Fails").

## Depends on

None
