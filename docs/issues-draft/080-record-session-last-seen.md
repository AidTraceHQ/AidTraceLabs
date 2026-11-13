# Record and index session last-seen activity

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 4

## Problem statement

`sessions` declares `last_seen_at TIMESTAMPTZ` (`migrations/001_initial_schema.sql:31`), and
`docs/backend-design.md:79` states it is "not currently updated by request handling". No code path updates
it: `getSession` reads the session and its role but never writes recency (`server/auth.ts:100-130`), and no
other statement touches the column. The column is therefore always NULL, so the database cannot distinguish
an actively used session from a stale one, and there is no data to support an active-session view or a future
idle-timeout policy. Affected: operators and future session-management work that depend on session recency.

## Technical implementation requirements

- Advance `sessions.last_seen_at` when an authenticated request resolves a session, but throttle the write so
  it does not add one `UPDATE` per request (for example, only update when the stored value is older than a
  short threshold).
- Keep session validation, expiry, revocation, cookie attributes, and CSRF behaviour unchanged.
- Add an index only if a recency query genuinely needs one; otherwise document why none is required.
- Do not add a background job or change the authentication flow.

## Files and areas to touch

- `server/auth.ts`
- `migrations/` (index only if required by a recency query)
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Dependencies

- None.

## Measurable acceptance criteria

- A database-backed test sends one authenticated request and asserts `SELECT last_seen_at FROM sessions` is
  non-NULL afterwards; a second request inside the throttle window leaves `last_seen_at` unchanged (equal value).
- A test asserts `getSession` returns null for an expired/revoked session row, and `POST /api/auth/logout`
  returns a `Set-Cookie` that clears the session cookie.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` exit 0.

## Expected deliverables

- Throttled recency update in the session path, a database-backed test, and an update to the `sessions`
  notes in `docs/backend-design.md`.

## How to set up and run tests

- Configure the disposable `TEST_DATABASE_URL` described in `CONTRIBUTING.md`, then
  `npm test -- tests/backend.test.ts` and `npm run typecheck`.

## Out of scope

- Enforcing idle timeouts, adding a sessions listing endpoint or UI, or rewriting authentication.

## Suggested labels

- `area: data`, `type: enhancement`, `difficulty: medium`
