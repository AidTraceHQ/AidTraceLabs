# Make Record Creation Retry-Safe After Commit

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 16 hours

**Release day:** Day 1

## Problem statement

The `POST /api/records` route handler (`server/records.ts:789-868`, whose `withTransaction` block inserts the record and audit rows) commits before verification-result persistence and the final record reload. If a later database operation fails, the client can receive an error even though the record exists; retrying a create without a transaction hash can create a second record. Organizations and admins cannot reliably distinguish “not saved” from “saved but response failed.”

## Technical implementation requirements

- Add an idempotency key to record creation, scoped to the authenticated organization wallet.
- Store the key, request fingerprint, and canonical record result atomically with the record/audit write.
- Return the original result for a retry with the same key and body; return `409` for reuse with a different body.
- Treat post-commit verification persistence/reload failures as a saved record in `pending` state, with a safe message and a later explicit Verify action.
- Keep database write transactions non-retried; do not alter authentication, authorization, or Stellar matching logic.

## Files and areas to touch

- `server/records.ts`
- `migrations/` (new idempotency receipt table or equivalent constraint)
- `src/api.ts`
- `src/App.tsx`
- `tests/backend.test.ts`

## Dependencies

- None.

## Measurable acceptance criteria

- Test `replays the same create request and returns the original record` asserts two identical `POST /api/records` calls with the same key return the same `201` `record.id`, and the `aid_records` and audit row counts each increase by exactly 1.
- Test `rejects key reuse with a changed body` asserts HTTP `409` and unchanged record/audit row counts.
- Test `keeps a post-commit persistence failure recoverable` forces the verification/reload write to throw and asserts a `2xx` response whose `record.status` is `pending` with a Verify path.
- Test `treats an empty-hash create as retry-safe` asserts an empty `txHash` returns `201` and a repeat adds no second row.
- `npm test -- tests/backend.test.ts` passes.

## Expected deliverables

- Idempotency persistence and API/client handling.
- Database-backed regression tests and concise API documentation for the key contract.

## How to set up and run tests

- Configure the dedicated disposable `TEST_DATABASE_URL`, `TEST_DATABASE_URL_UNPOOLED`, and `TEST_DATABASE_BRANCH=test` as documented in `CONTRIBUTING.md`.
- Run `npm test -- tests/backend.test.ts` and `npm run typecheck`.

## Out of scope

- Retrying arbitrary writes, a generic job queue, scheduled reverification (existing GitHub issue #18), or changes to payment verification rules.

## Suggested labels

- `area: backend`, `area: security`, `type: enhancement`, `difficulty: high`.
