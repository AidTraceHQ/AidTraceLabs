# Security Overview

This document summarizes the implemented controls and known gaps. It is not a security certification or a claim that a deployed service has been penetration-tested.

## Threat model summary

AidTrace handles wallet public addresses, session state, role assignments, aid record details, and public chain data. Relevant risks include forged wallet identity, cross-site requests, unauthorized record/role changes, transaction mismatch, accidental publication of beneficiary data, SQL injection, secret compromise, and abuse of public endpoints.

## Current controls

- Wallet ownership uses a five-minute, single-use challenge and Stellar SDK signature verification. No secret key is requested or stored.
- Session and CSRF tokens are random and stored hashed; cookies are HttpOnly, Secure, and SameSite=Lax. Logout-everywhere revokes sessions for one wallet.
- Mutations enforce server-side roles, organization ownership, CSRF, and configured Origin checks. SQL values are parameterized.
- Transaction checks compare source, destination, amount, asset, and issuer against a matching operation on the selected network. Horizon failures or incomplete pagination are not reported as verified.
- Consent-off public projections use an HMAC pseudonym keyed by `PSEUDONYM_SECRET`, separate from `SESSION_SECRET`, and withhold selected direct identifiers. This is data minimization, not anonymity.
- Rate limits use database-backed counters for selected authentication, write, and verification operations. Responses disable caching.

## Multi-operation transaction verification

A successful transaction is read in ascending pages of 200 operations, bounded at 20 pages. Verification accepts the transaction only when a **single eligible operation** carries every checked field: source organization wallet, recipient wallet, exact amount in stroops, asset code, and issuer. Fields found on different operations are never combined to create a match, even if every field appears somewhere in the transaction.

Eligible payment-like operation types, and why:

- `payment` — a direct asset transfer with explicit `to`, `amount`, and `asset_*` fields that map cleanly to the record.
- `create_account` — creates and funds a new account; `account`, `starting_balance`, and `funder` supply the destination, amount, and source, and the asset is native XLM.
- `path_payment_strict_receive` — the recipient receives a fixed `amount` and `asset_*`, which are the fields the record describes.
- `path_payment_strict_send` — the sender commits a maximum, so the recipient-side `destination_amount` and `destination_asset_*` are compared instead.

Other operation types (`set_options`, `manage_data`, `account_merge`, claimable-balance operations, and similar) are not eligible. They either do not deliver value to the recorded recipient or do not expose an explicit, independently matchable source/destination/amount/asset set, so counting them would require inference. They are ignored for matching even when their payload contains lookalike fields.

Multi-operation behavior:

- Repeated matching payments: the first fully matching eligible operation verifies the transaction; further matches do not change the status.
- Split-field near-matches: if one operation matches the destination and another matches the amount, the result is `mismatch` with "No single payment operation matches all recorded fields" alongside any fields missing everywhere.
- Unrelated operations: ignored. One fully matching eligible operation is enough to verify; a transaction with no eligible operation is a `mismatch`.
- Incomplete operation pagination: an unreadable page, a full page without a paging token, or more than 20 pages returns `pending`. A match on an earlier page never turns an incomplete read into `verified` or `mismatch`.

The `verified`/`mismatch` cache expiry is unchanged; `pending` results are never cached as final outcomes.

## Secret handling

Set distinct random values of at least 32 bytes for `SESSION_SECRET` and `PSEUDONYM_SECRET`. Production startup fails if `PSEUDONYM_SECRET` is missing or too short. Startup also fails, in any environment, if `SESSION_SECRET` and `PSEUDONYM_SECRET` are set to the same value. Only local `NODE_ENV=development` has a clearly marked fallback; configure an explicit key for any shared environment. Never expose these values through `VITE_*`, source control, logs, or issue reports.

## Known gaps

General per-IP/read rate limiting, last-admin protection, complete failure/rejection audit coverage, database-enforced append-only audit access, and explicit evidence of beneficiary consent are not implemented. Public records can still reveal amounts, dates, purposes, organization, and creator. A `verified` status does not establish identity, consent, purpose, or impact.

Report vulnerabilities privately using [SECURITY.md](../SECURITY.md). Use a dedicated test database and Stellar testnet for authorized checks; do not test against a live deployment without permission.
