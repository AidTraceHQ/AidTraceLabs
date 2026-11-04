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

## Secret handling

Set distinct random values of at least 32 bytes for `SESSION_SECRET` and `PSEUDONYM_SECRET`. Production startup fails if `PSEUDONYM_SECRET` is missing or too short. Only local `NODE_ENV=development` has a clearly marked fallback; configure an explicit key for any shared environment. Never expose these values through `VITE_*`, source control, logs, or issue reports.

## Known gaps

General per-IP/read rate limiting, last-admin protection, complete failure/rejection audit coverage, database-enforced append-only audit access, and explicit evidence of beneficiary consent are not implemented. Public records can still reveal amounts, dates, purposes, organization, and creator. A `verified` status does not establish identity, consent, purpose, or impact.

Report vulnerabilities privately using [SECURITY.md](../SECURITY.md). Use a dedicated test database and Stellar testnet for authorized checks; do not test against a live deployment without permission.
