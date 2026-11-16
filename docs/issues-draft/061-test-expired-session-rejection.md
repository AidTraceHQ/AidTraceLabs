# Test Expired Session Rejection

**Complexity:** medium

## Context

`getSession` in `server/auth.ts` (function `getSession`, lines 100–118, filter at line 116) only accepts a session with `revoked_at IS NULL AND expires_at > NOW()`, and `/api/me` clears the cookie when no session is found (lines 336–342). Tests cover challenge expiry and logout revocation but never a session whose `expires_at` has passed, so the seven-day TTL (lines 22, 270) is unverified. Affected: anyone relying on sessions actually expiring. Current behavior: expired sessions are not tested and could regress silently.

## Acceptance criteria

- A test logs in, sets the session row's `expires_at` to the past, and asserts `GET /api/me` returns `{ session: null }` and a clearing `Set-Cookie` (lines 340–341).
- A test asserts `POST /api/records` returns 401 once the session is expired (lines 332–336).
- A test asserts a non-expired session still returns its address/role.
- `npm test -- tests/backend.test.ts` passes; `npm run typecheck` passes.

## Files to touch

- `tests/backend.test.ts`

## Test expectations

- Configure: `TEST_DATABASE_URL`/`TEST_DATABASE_BRANCH=test`
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Sliding expiry, "remember me", or changing `sessionTtlMs`.

## Depends on

None
