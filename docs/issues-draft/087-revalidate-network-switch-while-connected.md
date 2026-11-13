# Re-validate or warn when the network is switched with an active session

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 3

## Problem statement

A session is bound to the network chosen at connect time: `connectWallet` rejects a Freighter wallet
whose network differs (`src/App.tsx:555-562`) and requests the challenge for the current `network`
(`src/App.tsx:563-566`, the `/api/auth/challenge` `api.post`). After connecting, the top-level network selector
can still change `network`. The wallet-activity Refresh button then queries Horizon for the new network
(`loadActivity(session.address, network)` at `src/App.tsx:1390-1393`) while the session cookie, role, and record
reads remain on the original network. Nothing warns the user or invalidates the session, so the activity tab can
show a different chain than the records the user is managing. Affected: any connected wallet that toggles
testnet/mainnet.

## Technical implementation requirements

- When a session is active, either disable the network switch with a visible explanation, or require
  an explicit reconnect and clear the session before switching.
- Keep `network-preference.ts` persistence (`src/network-preference.ts:10-20`,
  `readNetworkPreference`/`writeNetworkPreference`) for the disconnected case.
- Do not change the server challenge/verify contract or the cookie settings.
- Existing GitHub issue #11 (testnet context banner) is a display-only change; this must actually prevent
  the session/network mismatch.

## Files and areas to touch

- `src/App.tsx`
- `src/network-preference.ts` (only if the switch handler moves)

## Dependencies

- None. Distinct from existing GitHub issue #11 (banner) and from the record-form network-default draft.

## Measurable acceptance criteria

- With a session active, attempting to change `network` either leaves `network` unchanged and shows an
  explanation, or calls `disconnect()` so `session` becomes null; in no case does an active session remain
  while `network !== session.network`.
- With no session, switching networks still persists the choice via `writeNetworkPreference` and reloads the
  ledger.
- `npm run typecheck` and `npm test` exit 0.

## Expected deliverables

- A guarded network switch (or forced reconnect) while connected, with a visible rationale.

## How to set up and run tests

- Run `npm run dev`, connect a testnet wallet, then attempt to switch to mainnet and confirm the
  guard; disconnect and confirm the preference still persists.

## Out of scope

- Horizon endpoint configuration from env, multi-network sessions, and the testnet banner.

## Suggested labels

- `area: frontend`, `type: bug`, `difficulty: medium`
