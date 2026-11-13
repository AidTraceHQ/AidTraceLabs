# Test Logout-Everywhere Revokes All Wallet Sessions

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 3

## Problem statement

`/api/auth/logout-everywhere` revokes every session for the wallet (`server/auth.ts:392-396`), but the only test creates a single session and re-checks that same session (`tests/backend.test.ts:886-894`). A second concurrent session for the same wallet is never created or verified as revoked, so the cross-device guarantee is untested. Affected: users who sign out everywhere expecting their other devices to be logged out.

## Technical implementation requirements

- Create two independent sessions for one wallet, call logout-everywhere through one of them, and assert both `/api/me` responses return `{ session: null }`.
- Assert a second wallet's session is unaffected (the revocation is wallet-scoped).
- Assert the `wallet_logout_everywhere` audit event is written (`server/auth.ts:397-401`).
- Keep the existing single-session assertion.
- Do NOT change the revocation query, the sessions table, or cookie behavior.

## Files and areas to touch

- `tests/backend.test.ts`

## Dependencies

- Requires a test database.

## Measurable acceptance criteria

- Both sessions for the target wallet are revoked after logout-everywhere; another wallet's session still resolves.
- `npm test -- tests/backend.test.ts` passes; `npm run typecheck` passes.

## Expected deliverables

- A multi-session revocation integration test.

## How to set up and run tests

- Configure `TEST_DATABASE_URL`/`TEST_DATABASE_BRANCH=test`, then `npm test -- tests/backend.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- A session-management UI, refresh-token design, or per-device revocation.

## Suggested labels

- `area: security`, `area: testing`, `type: enhancement`, `difficulty: medium`.
