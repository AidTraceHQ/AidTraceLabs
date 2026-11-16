# Re-Validate or Warn When the Network Is Switched With an Active Session

**Complexity:** medium

## Context

A session is bound to the network chosen at connect time: `connectWallet` in `src/App.tsx` rejects a Freighter wallet whose network differs (lines 555–562) and requests the challenge for the current `network` (lines 563–566). After connecting, the top-level network selector can still change `network`. The wallet-activity Refresh then queries Horizon for the new network (`loadActivity(session.address, network)` at lines 1390–1393) while the session cookie, role, and record reads remain on the original network. Nothing warns the user or invalidates the session. Affected: any connected wallet that toggles testnet/mainnet. Current behavior: the network selector remains active during a session and silently creates a mismatch. Expected behavior: when a session is active, switching networks either leaves `network` unchanged with a visible explanation, or requires an explicit reconnect and clears the session before switching.

## Acceptance criteria

- With a session active, attempting to change `network` either leaves `network` unchanged and shows an explanation, or calls `disconnect()` so `session` becomes null; in no case does an active session remain while `network !== session.network`.
- With no session, switching networks still persists the choice via `writeNetworkPreference` in `src/network-preference.ts` (function `writeNetworkPreference`, lines 10–20) and reloads the ledger.
- `npm run typecheck` and `npm test` exit 0.

## Files to touch

- `src/App.tsx`
- `src/network-preference.ts` (only if the switch handler moves)

## Test expectations

- Manual: run `npm run dev`, connect a testnet wallet, attempt to switch to mainnet and confirm the guard; disconnect and confirm the preference still persists.
- Run: `npm run typecheck`
- Run: `npm test`

## Out of scope

Horizon endpoint configuration from env, multi-network sessions, and the testnet banner (tracked by a separate open issue).

## Depends on

None
