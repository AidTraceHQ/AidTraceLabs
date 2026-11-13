# Test Expired Session Rejection

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 4

## Problem statement

`getSession` only accepts a session with `revoked_at IS NULL AND expires_at > NOW()` (`server/auth.ts:100-118`, filter at `server/auth.ts:116`), and `/api/me` clears the cookie when no session is found (`server/auth.ts:336-342`). Tests cover challenge expiry (`tests/backend.test.ts:489-506`) and logout revocation (`tests/backend.test.ts:508-517`), but never a _session_ whose `expires_at` has passed, so the seven-day TTL (`server/auth.ts:22`, `server/auth.ts:270`) is unverified. Affected: anyone relying on sessions actually expiring.

## Technical implementation requirements

- Log in, then set the session row's `expires_at` to the past and assert `/api/me` returns `{ session: null }` and a clearing `Set-Cookie` (`server/auth.ts:340-341`).
- Assert a protected write (`POST /api/records`) returns 401 once the session is expired (`server/records.ts:332-336`).
- Keep an assertion that a non-expired session still works.
- Do NOT shorten the TTL, change cookie flags, or alter the expiry predicate.

## Files and areas to touch

- `tests/backend.test.ts`

## Dependencies

- Requires a test database.

## Measurable acceptance criteria

- An expired session yields `{ session: null }` on `/api/me` and 401 on `/api/records`.
- A non-expired session still returns its address/role.
- `npm test -- tests/backend.test.ts` passes; `npm run typecheck` passes.

## Expected deliverables

- Session-expiry integration cases.

## How to set up and run tests

- Configure `TEST_DATABASE_URL`/`TEST_DATABASE_BRANCH=test`, then `npm test -- tests/backend.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- Sliding expiry, "remember me", or changing `sessionTtlMs`.

## Suggested labels

- `area: security`, `area: testing`, `type: enhancement`, `difficulty: medium`.
