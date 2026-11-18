# Record and Index Session Last-Seen Activity

**Complexity:** intermediate

## Context

`sessions` declares `last_seen_at TIMESTAMPTZ` in `migrations/001_initial_schema.sql` (line 31), and `docs/backend-design.md` (line 79) states it is "not currently updated by request handling". `getSession` in `server/auth.ts` (function `getSession`, lines 100Ã¢â‚¬â€œ130) reads the session and its role but never writes recency. The column is therefore always NULL, so the database cannot distinguish an actively used session from a stale one. Affected: operators and future session-management work that depends on session recency. Current behavior: `last_seen_at` is always NULL. Expected behavior: `last_seen_at` is advanced on authenticated requests, throttled so it does not add one `UPDATE` per request (e.g. only update when the stored value is older than a short threshold).

## Acceptance criteria

- A database-backed test sends one authenticated request and asserts `SELECT last_seen_at FROM sessions` is non-NULL afterwards; a second request inside the throttle window leaves `last_seen_at` unchanged (equal value).
- A test asserts `getSession` returns null for an expired/revoked session row, and `POST /api/auth/logout` returns a `Set-Cookie` that clears the session cookie.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` exit 0.

## Files to touch

- `server/auth.ts`
- `migrations/` (index only if required by a recency query)
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Test expectations

- Configure: disposable `TEST_DATABASE_URL` (see `CONTRIBUTING.md`)
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Enforcing idle timeouts, adding a sessions listing endpoint or UI, or rewriting authentication.

## Depends on

None
