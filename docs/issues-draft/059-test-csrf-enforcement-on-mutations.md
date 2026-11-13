# Test CSRF Rejection on Every Mutating Route

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 16 hours

**Release day:** Day 2

## Problem statement

All writes require both an allowed Origin and a valid CSRF token (`server/records.ts:341-349`; `server/auth.ts:359-362`; `server/auth.ts:387-390`), but tests only exercise the missing-token case for logout (`tests/backend.test.ts:456-461`) and void (`tests/backend.test.ts:836-841`). There is no test that a present-but-forged CSRF token is rejected, and no CSRF test at all for record create, record update, `/api/records/:id/verify`, admin role add/remove, or logout-everywhere. A regression that weakened the CSRF check would not fail the suite. Affected: every authenticated user whose account could be driven by a cross-site request.

## Technical implementation requirements

- Add tests that send an incorrect `csrfToken` to each write route and assert 403: another session's token, a mutated value, and an over-length string (see the length guard in `server/auth.ts:93-98`).
- Add missing-token assertions for `/api/records` (POST), `PUT /api/records/:id`, `/api/records/:id/verify`, `/api/admin/roles` (POST and DELETE), and `/api/auth/logout-everywhere`.
- Keep a valid Origin and an authenticated session in these cases so only the CSRF gate is under test.
- Do NOT change the CSRF algorithm, the token derivation (`server/auth.ts:35-36`), cookie flags, or the `csrfMatches` comparison.

## Files and areas to touch

- `tests/backend.test.ts` (database-backed suite; add a reusable forged/missing CSRF helper if it reduces duplication)

## Dependencies

- Requires a configured test database for the integration cases. Distinct from auditing rejections and from the per-IP rate-limit store work.

## Measurable acceptance criteria

- Each listed mutating route returns 403 for a forged token and for a missing token.
- A valid token still returns the existing success status for each route.
- `npm test -- tests/backend.test.ts` passes with `TEST_DATABASE_URL` configured.
- `npm run typecheck` passes.

## Expected deliverables

- New CSRF cases covering every write route, plus a short list of covered routes in the test comments.

## How to set up and run tests

- Configure `TEST_DATABASE_URL`/`TEST_DATABASE_URL_UNPOOLED` with `TEST_DATABASE_BRANCH=test`, then run `npm test -- tests/backend.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- Changing origin policy, session/cookie settings, or adding a new CSRF mechanism.

## Suggested labels

- `area: security`, `area: testing`, `type: enhancement`, `difficulty: high`.
