# Test Logout-Everywhere Revokes All Wallet Sessions

**Complexity:** medium

## Context

`/api/auth/logout-everywhere` revokes every session for the wallet in `server/auth.ts` (lines 392–396), but the only test creates a single session and re-checks that same session in `tests/backend.test.ts` (lines 886–894). A second concurrent session for the same wallet is never created or verified as revoked, so the cross-device guarantee is untested. Affected: users who sign out everywhere expecting their other devices to be logged out.

## Acceptance criteria

- A test creates two independent sessions for one wallet, calls logout-everywhere through one, and asserts both `/api/me` responses return `{ session: null }`.
- A test asserts a second wallet's session is unaffected (revocation is wallet-scoped).
- A test asserts the `wallet_logout_everywhere` audit event is written (lines 397–401).
- The existing single-session assertion is kept.
- `npm test -- tests/backend.test.ts` passes; `npm run typecheck` passes.

## Files to touch

- `tests/backend.test.ts`

## Test expectations

- Configure: `TEST_DATABASE_URL`/`TEST_DATABASE_BRANCH=test`
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

A session-management UI, refresh-token design, or per-device revocation.

## Depends on

None
