# Test CSRF Rejection on Every Mutating Route

**Complexity:** advanced

## Context

All writes require both an allowed Origin and a valid CSRF token in `server/records.ts` (lines 341Ã¢â‚¬â€œ349), `server/auth.ts` (lines 359Ã¢â‚¬â€œ362), and `server/auth.ts` (lines 387Ã¢â‚¬â€œ390). Tests only exercise the missing-token case for logout and void. There is no test that a present-but-forged CSRF token is rejected, and no CSRF test at all for record create, record update, `POST /api/records/:id/verify`, admin role add/remove, or logout-everywhere. A regression that weakened the CSRF check would not fail the suite. Affected: every authenticated user whose account could be driven by a cross-site request.

## Acceptance criteria

- Each of the listed mutating routes returns 403 for a forged token (another session's token, a mutated value, and an over-length string per the length guard in `server/auth.ts`, lines 93Ã¢â‚¬â€œ98) and for a missing token.
- A valid token still returns the existing success status for each route.
- `npm test -- tests/backend.test.ts` passes with `TEST_DATABASE_URL` configured.
- `npm run typecheck` passes.

## Files to touch

- `tests/backend.test.ts` (add a reusable forged/missing CSRF helper if it reduces duplication)

## Test expectations

- Configure: `TEST_DATABASE_URL`/`TEST_DATABASE_URL_UNPOOLED` with `TEST_DATABASE_BRANCH=test`
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Changing origin policy, session/cookie settings, or adding a new CSRF mechanism.

## Depends on

None
