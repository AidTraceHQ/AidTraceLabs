# Make Record Creation Retry-Safe After Commit

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 16 hours

**Release day:** Day 1

## Problem statement

`POST /api/records` commits the record and audit row before verification-result persistence and the final record reload (`server/records.ts:789-868`). If a later database operation fails, the client can receive an error even though the record exists; retrying a create without a transaction hash can create a second record. Organizations and admins cannot reliably distinguish “not saved” from “saved but response failed.”

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

- Repeating the same create request with the same key returns the same record ID and leaves one record/audit creation.
- Reusing a key with a different payload returns `409` and does not mutate data.
- A failure after the primary commit produces a response that makes the persisted `pending` record recoverable.
- Requests without a transaction hash remain safe to retry.

## Expected deliverables

- Idempotency persistence and API/client handling.
- Database-backed regression tests and concise API documentation for the key contract.

## How to set up and run tests

- Configure the dedicated disposable `TEST_DATABASE_URL`, `TEST_DATABASE_URL_UNPOOLED`, and `TEST_DATABASE_BRANCH=test` as documented in `CONTRIBUTING.md`.
- Run `npm test -- tests/backend.test.ts` and `npm run typecheck`.

## Out of scope

- Retrying arbitrary writes, a generic job queue, scheduled reverification (#18), or changes to payment verification rules.

## Suggested labels

- `area: backend`, `area: security`, `type: enhancement`, `difficulty: high`.
