# AidTrace manual test checklist

Run this checklist against the Neon `dev` branch and a Stellar testnet wallet.
Do not use production credentials or submit a real payment. The automated test
suite covers the API and database contracts; this checklist covers browser,
Freighter and deployment wiring.

## Setup

- [ ] Confirm `neon checkout dev` reports `dev`; `DATABASE_URL` must target
  `dev`. Keep `TEST_DATABASE_URL` pointed at the isolated `test` branch.
- [ ] Confirm migrations 001 and 002 are applied on `dev`.
- [ ] Configure `ADMIN_WALLET` with the intended public Stellar admin address,
  then run `npm run db:seed-admin`.
- [ ] Start the Express API and Vite frontend using the documented development
  commands. Confirm the API health check responds with
  `{"ok":true,"service":"aidtrace-wallet-api"}`.

## Wallet authentication and session security

- [ ] Open the frontend over its configured origin and connect a testnet
  wallet in Freighter.
- [ ] Inspect the login challenge message. Confirm `Domain` matches the origin
  from `PUBLIC_APP_ORIGIN`, and `Issued At` and `Expires` are five minutes
  apart.
- [ ] Sign with Freighter. Confirm the UI shows the connected address and
  role, and the session cookie is Secure, HttpOnly, SameSite=Lax, and expires
  after seven days.
- [ ] Reload and confirm the session persists. Log out and confirm the session
  is invalidated and the cookie is cleared.
- [ ] Request a fresh challenge, then try to reuse its signature after a
  successful login; the reused challenge must be rejected.
- [ ] Confirm a request from an untrusted Origin and an authenticated
  state-changing request without a valid CSRF token are rejected.

## Records, verification, privacy and administration

- [ ] As an organization wallet, create a testnet aid record with a pseudonymous
  beneficiary. Confirm the record is visible in the public transparency list
  without beneficiary wallet, private note, transaction hash, or restricted
  verification details when consent is false.
- [ ] Create or edit a record with an existing `(network, tx_hash)` and confirm
  the API rejects the duplicate without changing the existing record.
- [ ] Verify a transaction whose source, destination, amount and asset match
  the organization's configured wallet and record. Confirm the displayed
  result is verified; try a mismatching source and confirm it is not verified.
- [ ] With recipient consent enabled, confirm the approved public projection
  is shown. Confirm voiding retains the record and records the reason, actor
  and time instead of deleting it.
- [ ] Exercise list filters and cursor pagination, including navigating
  forward and changing a filter while using an old cursor.
- [ ] As an admin, list roles and audit events, change a role, and confirm the
  action is audited. Confirm a wallet cannot remove or demote its own active
  admin role.

## Shutdown and cleanup

- [ ] Stop both development processes and confirm the API pool closes without
  leaving an active local listener.
- [ ] Confirm `.env.local` remains ignored and no connection strings,
  signatures, session cookies, or private keys were added to Git.
