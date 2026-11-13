# Test Pagination Cursor Integrity and Bounds

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 14 hours

**Release day:** Day 2

## Problem statement

Cursor pages are integrity-protected: an HMAC envelope plus a filter digest (`server/records.ts:374-411`), with `limit` bounds (`server/records.ts:361-366`) and a 512-character cursor cap (`server/records.ts:369-371`). The suite only checks that a cursor reused with different filters returns 400 (`tests/backend.test.ts:769-772`) and performs a clean two-page walk (`tests/backend.test.ts:762-768`). A tampered signature, a tampered payload, or an out-of-range `limit` is never asserted, so the cursor integrity binding is untested. Affected: pagination integrity on the public ledger, admin roles, and audit views.

## Technical implementation requirements

- Add tests that: flip a byte in the cursor `signature`; re-encode a payload with a changed `id`/`createdAt`; send a non-enveloped/garbage cursor; and send `limit=0`, `limit=101`, `limit=abc`, and a cursor longer than 512 characters — asserting 400 with the documented messages (`server/records.ts:363-419`).
- Assert a valid `nextCursor` continues to page correctly.
- Keep the HMAC and filter-digest scheme and the error strings unchanged; do NOT weaken or remove the signature check.

## Files and areas to touch

- `tests/backend.test.ts`

## Dependencies

- Requires a test database (list routes read from the database). Distinct from UI pagination and bookmarkable-filter work.

## Measurable acceptance criteria

- Tampered or invalid cursors and out-of-range limits return 400; valid cursors page correctly.
- `npm test -- tests/backend.test.ts` passes; `npm run typecheck` passes.

## Expected deliverables

- Cursor-integrity and bounds tests.

## How to set up and run tests

- Configure `TEST_DATABASE_URL`/`TEST_DATABASE_BRANCH=test`, then `npm test -- tests/backend.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- Changing the cursor format, the signing key, the page size, or adding cursor evolution.

## Suggested labels

- `area: security`, `area: testing`, `type: enhancement`, `difficulty: high`.
