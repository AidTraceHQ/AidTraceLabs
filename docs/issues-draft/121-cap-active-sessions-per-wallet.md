# Cap and Report Active Sessions per Wallet

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 7 hours

**Release day:** Day 1

## Problem statement

Every successful signature verification inserts a brand-new session row and never limits how many can
exist for one wallet:

```
INSERT INTO sessions (session_hash, wallet_address, network, csrf_token_hash, expires_at)
VALUES ($1, $2, $3, $4, $5)
```

(`server/auth.ts:302-306`). Sessions live for seven days (`server/auth.ts:22`,
`sessionTtlMs = 7 * 24 * 60 * 60 * 1000`) and are only invalidated by `logout` or `logout-everywhere`
(`server/auth.ts:364-374, 391-402`).

A user who reconnects repeatedly — or an attacker who repeatedly triggers the public
`POST /api/auth/verify` path with a captured signature — accumulates unbounded live sessions, each in a
separate browser profile, with no way to see or prune them individually. Because `sessions` has no
`last_seen_at` write path either (the column exists at `migrations/001_initial_schema.sql:31` but is
never updated), an operator cannot even identify the stale ones.

Affected: wallet owners who cannot reason about where they are still signed in, and the maintainer
responsible for session hygiene on a tool that handles aid records.

## Technical implementation requirements

- On successful verification (`server/auth.ts:272-313`), keep at most a bounded number of **active**
  sessions per wallet (choose a documented default, for example 5) by revoking the oldest active
  sessions in the same transaction that inserts the new one. Reuse the existing
  `sessions_wallet_expiry_idx` index on `(wallet_address, revoked_at, expires_at)`
  (`migrations/001_initial_schema.sql:33`).
- Revoke by setting `revoked_at`, never by deleting rows, so the audit trail and the append-only
  expectations of `audit_events` are respected.
- Record the revocation of evicted sessions in `audit_events` so the eviction is explainable, matching
  the style of the existing `wallet_logged_out` insert (`server/auth.ts:369-373`).
- Change the retire order to oldest-first by `created_at` (ties broken deterministically), so a
  reconnect does not evict the session currently in use.
- Keep the one-five-minute single-use challenge behaviour, the CSRF check, and the seven-day expiry
  unchanged. Do not weaken or bypass any check.
- Add a read-only way for a signed-in wallet to see how many active sessions it has. A minimal
  `GET /api/auth/sessions` returning counts and the current session's marker is sufficient; do not
  return hashes or tokens.
- Document the cap, the eviction order, and the new endpoint in `docs/api.md` and `docs/security.md`
  (known-gaps wording may need to change).

## Files and areas to touch

- `server/auth.ts`
- `server/records.ts` only if a shared audit helper is extracted; otherwise leave it alone
- `tests/backend.test.ts`
- `docs/api.md`
- `docs/security.md`
- `migrations/` only if a supporting index is genuinely needed (an index already covers the lookup)

## Dependencies

- Related to draft "Record and index session last-seen activity" (record `last_seen_at`) and draft "Test Logout-Everywhere Revokes All Wallet Sessions" (test logout-everywhere with two real
  sessions) and draft "Clean Up Expired Authentication and Rate-Limit Rows" (clean expired ephemeral rows). This issue adds the per-wallet cap and the
  visibility endpoint; it does not replace those, and "Test Logout-Everywhere Revokes All Wallet Sessions"'s two-session test must keep passing.

## Measurable acceptance criteria

- After N+1 logins for one wallet, exactly N sessions remain active (`revoked_at IS NULL`), and the most
  recently created session is among them.
- The eviction is visible in `audit_events`, and no session row is deleted.
- `GET /api/auth/sessions` requires a valid session and returns only counts/current-session markers.
- An evicted session is rejected on its next request, matching the existing revoked-session behaviour
  (`server/auth.ts:116`).
- `npm test -- tests/backend.test.ts`, `npm run typecheck`, and `npm run lint` pass.

## Expected deliverables

- The bounded-session logic in the verify transaction, the read-only sessions endpoint, database-backed
  tests, and documentation updates.

## How to set up and run tests

- Use a disposable `TEST_DATABASE_URL` (`CONTRIBUTING.md:39`).
- `npm test -- tests/backend.test.ts`
- Manual: sign in the same testnet wallet from several browser profiles, then call
  `GET /api/auth/sessions` and confirm the reported count is capped and older sessions are rejected.

## Out of scope

- Device fingerprinting, IP logging, per-session revocation UI, refresh tokens, and changing the
  seven-day lifetime or the challenge flow.

## Suggested labels

- `area: security`, `area: backend`, `type: enhancement`, `difficulty: medium`.
