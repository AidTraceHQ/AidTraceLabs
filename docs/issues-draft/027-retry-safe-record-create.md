# Make Record Creation Retry-Safe After Commit

**Complexity:** advanced

## Context

`POST /api/records` commits the record and audit rows, then attempts to persist the verification result and reload the record. If a later database operation fails, the client receives an error even though the record was saved. Retrying a create without a transaction hash can create a second record. Affected users: organizations and admins who cannot distinguish "not saved" from "saved but response failed." Current behavior: `server/records.ts` (function containing the `withTransaction` block at approximately lines 789Ã¢â‚¬â€œ868) commits before all post-commit work; there is no idempotency key. Expected behavior: an idempotency key scoped to the authenticated organization wallet prevents duplicate records; post-commit persistence failures surface as a saved record in `pending` state with a Verify path.

## Acceptance criteria

- A test replays the same create request with the same key and asserts both calls return `201` with the same `record.id`, and the `aid_records` and audit row counts each increase by exactly one.
- A test with key reuse and a changed body asserts HTTP `409` and unchanged row counts.
- A test forces the post-commit verification/reload write to throw and asserts a `2xx` response whose `record.status` is `pending` with a Verify path.
- A test with an empty `txHash` asserts `201` and a repeat adds no second row.
- `npm test -- tests/backend.test.ts` passes.

## Files to touch

- `server/records.ts`
- `migrations/` (new idempotency receipt table or equivalent constraint)
- `src/api.ts`
- `src/App.tsx`
- `tests/backend.test.ts`

## Test expectations

- Configure: `TEST_DATABASE_URL`, `TEST_DATABASE_URL_UNPOOLED`, `TEST_DATABASE_BRANCH=test` (see `CONTRIBUTING.md`).
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Retrying arbitrary writes, a generic job queue, scheduled reverification (tracked by a separate open issue), or changes to payment verification rules.

## Depends on

None
