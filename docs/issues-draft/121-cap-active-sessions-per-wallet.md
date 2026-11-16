# Cap and Report Active Sessions per Wallet

**Complexity:** medium

## Context

Every successful signature verification in `server/auth.ts` (the INSERT at lines 302–306) creates a new session row with no limit on how many can exist for one wallet. Sessions live for seven days (constant `sessionTtlMs` at line 22) and are only invalidated by logout or logout-everywhere (lines 364–374 and 391–402). A user who reconnects repeatedly — or an attacker with a captured signature — accumulates unbounded live sessions. Because `last_seen_at` is never updated (column exists in `migrations/001_initial_schema.sql`, line 31, but is never written), an operator cannot even identify stale sessions. Affected: wallet owners who cannot reason about where they are still signed in, and maintainers responsible for session hygiene.

## Acceptance criteria

- After N+1 logins for one wallet, exactly N sessions remain active (`revoked_at IS NULL`), and the most recently created session is among them.
- The eviction is visible in `audit_events`, and no session row is deleted.
- `GET /api/auth/sessions` requires a valid session and returns only counts/current-session markers.
- An evicted session is rejected on its next request, matching the existing revoked-session behavior (line 116).
- `npm test -- tests/backend.test.ts`, `npm run typecheck`, and `npm run lint` pass.

## Files to touch

- `server/auth.ts`
- `server/records.ts` (only if a shared audit helper is extracted)
- `tests/backend.test.ts`
- `docs/api.md`
- `docs/security.md`
- `migrations/` (only if a supporting index is genuinely needed; an index already covers the lookup)

## Test expectations

- Configure: disposable `TEST_DATABASE_URL` (see `CONTRIBUTING.md`)
- Run: `npm test -- tests/backend.test.ts`
- Manual: sign in the same testnet wallet from several browser profiles, then call `GET /api/auth/sessions` and confirm the reported count is capped and older sessions are rejected.

## Out of scope

Device fingerprinting, IP logging, per-session revocation UI, refresh tokens, and changing the seven-day lifetime or the challenge flow.

## Depends on

Record and Index Session Last-Seen Activity, Test Logout-Everywhere Revokes All Wallet Sessions, Clean Up Expired Authentication and Rate-Limit Rows
