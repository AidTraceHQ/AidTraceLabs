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
- Beneficiary publication acknowledgments are disabled by default and must remain disabled until product/privacy review approves enabling `CONSENT_ACKNOWLEDGMENTS_ENABLED`. When enabled, beneficiaries sign a five-minute, single-use, domain-bound v1 statement using their wallet; acknowledgment expires after 90 days and can be revoked with another wallet signature. Only message/signature hashes and the acknowledgment version/timestamps are retained; raw signatures are discarded. Used/expired challenge details are purged after one day. The wallet address is stored as the record’s beneficiary reference and is never included in public acknowledgment status.
- The exact v1 signed statement is: “I authorize AidTrace to publicly display my beneficiary name and wallet address, the record note and transaction hash, and this record verification destination, link, ledger, transaction time, checked source, amount, asset, issuer, and result, in addition to the standard public fields: record ID, pseudonymous beneficiary label, network, asset, amount, status, date, organization name, and verification outcome and checked fields. I understand that signing proves control of this wallet only; it does not establish my legal identity or prove informed consent.” This is evidence of a wallet signature, not identity verification or proof of informed consent.
- The public projection is allowlisted and gated by both the organization’s publication request and an active signed acknowledgment. Old checkbox-only consent is treated as unacknowledged until the beneficiary signs. The organization can withdraw its publication request; changing the beneficiary wallet or withdrawing the request invalidates active acknowledgments. Without active consent, the public fields are record ID, pseudonymous beneficiary label, network, asset, amount, status, date, organization name, and verification status/check time/differences/source account/checked amount/asset/issuer/reason. Purpose, record organization/creator wallet and record creation time are blank; void details, asset issuer at the record level, and the consent flag are omitted. Recipient name/address, transaction hash, note, and verification destination/link/ledger/transaction time also stay withheld. With both publication request and active acknowledgment, only the additional fields named in the signed statement are exposed. Acknowledgment alone never overrides the organization’s request or widens this projection.
- Rate limits use database-backed counters for selected authentication, write, and verification operations. Responses disable caching.
- The `aidtrace_runtime` database role can read and append audit events but cannot update or delete them. The separate `aidtrace_migration` owner role retains maintenance access; this does not protect against that owner or a database superuser.

## Secret handling

Set distinct random values of at least 32 bytes for `SESSION_SECRET` and `PSEUDONYM_SECRET`. Values beginning with `replace-with-` are treated as placeholders and rejected. Production startup fails if `PSEUDONYM_SECRET` is missing or too short. Startup also fails, in any environment, if `SESSION_SECRET` and `PSEUDONYM_SECRET` are set to the same value. Only local `NODE_ENV=development` has a clearly marked fallback; configure an explicit key for any shared environment. Never expose these values through `VITE_*`, source control, logs, or issue reports.

## Known gaps

General per-IP/read rate limiting, last-admin protection, complete failure/rejection audit coverage, and explicit evidence of beneficiary consent are not implemented. Public records can still reveal amounts, dates, purposes, organization, and creator. A `verified` status does not establish identity, consent, purpose, or impact.

Report vulnerabilities privately using [SECURITY.md](../SECURITY.md). Use a dedicated test database and Stellar testnet for authorized checks; do not test against a live deployment without permission.
