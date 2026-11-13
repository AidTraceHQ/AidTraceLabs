# Route Admin Role Mutations Through the Shared Transaction Helper

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 1

## Problem statement

The two admin role mutation handlers open a pooled client and hand-roll the transaction instead of using the shared helper. `POST /api/admin/roles` calls `pool.connect()`, `BEGIN`, `COMMIT`, and a `catch` that awaits `ROLLBACK` and rethrows (`server/records.ts:1144-1177`); `DELETE /api/admin/roles/:address` does the same but additionally rolls back manually inside the `try` before its 404 response (`server/records.ts:1195-1224`, especially `server/records.ts:1204-1208`). This duplicates `withTransaction` (`server/db.ts:31-44`) and gives these two routes two divergent rollback paths, so a fix to the shared helper will not reach them. Affected: maintainers and any future transaction-handling change, because role writes can silently drift from the rest of the API.

## Technical implementation requirements

- Replace the hand-rolled `pool.connect()`/`BEGIN`/`COMMIT`/`ROLLBACK` blocks in both handlers with `withTransaction` from `server/db.ts`.
- Keep the "Explicit role not found." outcome for a missing role by returning a sentinel from the transaction callback and responding after the helper resolves, rather than rolling back and responding mid-transaction (`server/records.ts:1204-1208`).
- Preserve the self-demotion guard (`server/records.ts:1140-1143`), the self-removal guard (`server/records.ts:1191-1194`), and both audit writes (`server/records.ts:1163-1170`, `server/records.ts:1210-1217`).
- Do NOT change `withTransaction`'s own rollback semantics; preserving the primary error when rollback fails is tracked by a separate draft.
- Do NOT change role validation, response bodies, or authorization.

## Files and areas to touch

- `server/records.ts`
- `tests/backend.test.ts`

## Dependencies

- None. Distinct from the rollback-masking draft and from migration serialization.

## Measurable acceptance criteria

- `server/records.ts` no longer contains direct `pool.connect()`, `client.query('BEGIN')`, or `client.query('COMMIT')` calls in the two admin role handlers.
- Assigning, changing, and removing a role still return `{ ok: true }`; removing a non-existent explicit role still returns 404 `{ "error": "Explicit role not found." }`.
- `npm test -- tests/backend.test.ts` passes and `npm run typecheck` passes.

## Expected deliverables

- Refactor of the two handlers onto `withTransaction`, plus tests covering role assignment, role change, role removal, and the not-found path.

## How to set up and run tests

- Configure the guarded test database (`TEST_DATABASE_URL`, `TEST_DATABASE_BRANCH=test`), then run `npm test -- tests/backend.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- Last-remaining-admin protection, role policy changes, or audit filtering.

## Suggested labels

- `area: backend`, `type: enhancement`, `difficulty: medium`
