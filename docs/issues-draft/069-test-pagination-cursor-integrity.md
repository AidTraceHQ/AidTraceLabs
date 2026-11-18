# Test Pagination Cursor Integrity and Bounds

**Complexity:** advanced

## Context

Cursor pages are integrity-protected via an HMAC envelope plus a filter digest in `server/records.ts` (functions `readPage`/`sendPage`, lines 374Ã¢â‚¬â€œ411), with `limit` bounds (lines 361Ã¢â‚¬â€œ366) and a 512-character cursor cap (lines 369Ã¢â‚¬â€œ371). The suite only checks that a cursor reused with different filters returns 400 and performs a clean two-page walk. A tampered signature, tampered payload, or out-of-range `limit` is never asserted, so cursor integrity binding is untested. Affected: pagination integrity on the public ledger, admin roles, and audit views.

## Acceptance criteria

- Tests assert 400 for: a byte-flipped cursor `signature`; a re-encoded payload with a changed `id`/`createdAt`; a non-enveloped/garbage cursor; `limit=0`; `limit=101`; `limit=abc`; and a cursor longer than 512 characters Ã¢â‚¬â€ with the documented messages.
- A valid `nextCursor` continues to page correctly.
- `npm test -- tests/backend.test.ts` passes; `npm run typecheck` passes.

## Files to touch

- `tests/backend.test.ts`

## Test expectations

- Configure: `TEST_DATABASE_URL`/`TEST_DATABASE_BRANCH=test`
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Changing the cursor format, the signing key, the page size, or adding cursor evolution.

## Depends on

None
