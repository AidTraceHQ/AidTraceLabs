# Lock Down Horizon Failure-State Contracts

**Complexity:** intermediate

## Context

The `checkTransaction` function in `server/stellar-verification.ts` (lines 145Ã¢â‚¬â€œ280) has distinct branches for transport failures, non-2xx responses, unknown transaction success, operation endpoint errors, malformed operation bodies, missing paging cursors, and explicitly unsuccessful transactions. The existing verification tests in `tests/backend.test.ts` (block at lines 80Ã¢â‚¬â€œ286) exercise success, mismatch, strict-send, not-found, and paging budget but not the complete transport failure contract. Affected users: maintainers who cannot detect regressions in failure-path verification behavior. Current behavior: eight failure shapes are unasserted; a future refactor could change their `status` or `reason` values silently. Expected behavior: a focused failure-contract test suite using mocked `fetch` asserts each shape with no live Horizon calls and no database credentials required.

## Acceptance criteria

- `npm test -- tests/backend.test.ts` runs a new failure-contract suite that stubs `fetch`, calls no live Horizon, and needs no wallet or database credential.
- Each of the eight failure shapes (timeout/network error, malformed JSON, 429, 5xx, missing success flag, operation failure, missing cursor, unsuccessful transaction) has an assertion on `status` and `reason`.
- A test asserts none of the failure shapes returns `status: 'verified'`.
- The suite runs with `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty.

## Files to touch

- `tests/backend.test.ts`
- `server/stellar-verification.ts` (only if a contract defect is demonstrated)
- `docs/backend-design.md` (if response-state wording changes)

## Test expectations

- Set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty to skip database integration.
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Multi-operation algorithm changes, scheduled reverification (tracked by a separate open issue), or new payment operation support.

## Depends on

None
