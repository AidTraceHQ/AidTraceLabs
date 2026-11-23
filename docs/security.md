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
- The `aidtrace_runtime` database role can read and append audit events but cannot update or delete them. The separate `aidtrace_migration` owner role retains maintenance access; this does not protect against that owner or a database superuser.

## Outbound notifications

Webhook alerts are opt-in and off by default. With `NOTIFICATIONS_ENABLED` unset or `false`, the `/api/notifications/*` routes fall through to the normal 404 response, record writes run no notification queries, and the delivery job exits without touching the notification tables.

### Delivery model (decided)

- **Webhooks only.** Email is not implemented: it needs a mail provider, address-ownership confirmation and bounce handling that the project does not yet operate. Revisit it as a separate decision.
- **Transactional outbox.** Record create, update, void and verification-status changes insert a `notification_deliveries` row in the same database transaction as the change. A separate job (`npm run notifications:deliver`) sends due rows. API requests never wait on, or fail because of, a receiver.
- **Events.** `record.created`, `record.updated`, `record.voided` and `record.verification_changed` (only when the status differs from the previous one). Each endpoint can subscribe to a subset.
- **Minimized payloads.** The body is built from an allowlist: event id, type, time, record id, network, status, previous status and record version. Recipient names, wallet addresses (beneficiary or organization), notes, purposes, amounts and transaction hashes are never sent. Receivers fetch details through the authenticated API, which applies its normal role and consent checks.

### Recipient-verification policy (decided)

- Only `organization` and `admin` wallets can register endpoints, with a session and CSRF token. Organizations receive events for their own records only. Admins may also register an `all` scope endpoint.
- Targets must be absolute `https://` URLs without embedded credentials. At registration and before every send, the hostname is resolved and **every** returned address must be public; the first address is pinned for the connection so a second DNS answer cannot redirect it.
- A new endpoint is `pending_verification` and receives nothing. The owner calls the verify route, which sends a signed `endpoint.verification` request carrying a random challenge. The endpoint becomes `active` only if it answers 2xx with exactly that challenge as the body.
- Endpoints are revocable by their owner or any admin. Revocation cancels every pending delivery. If the owner later loses the role that authorized the endpoint, queued deliveries are cancelled at send time instead of sent.
- Each owner may hold at most five non-revoked endpoints.

### Signing, replay and retries

- Each endpoint has a random `whsec_…` signing secret, shown once at creation or rotation. The secret and the full target URL (which may embed a path token) are stored only as AES-256-GCM ciphertexts keyed by `NOTIFICATIONS_ENCRYPTION_KEY`, with the endpoint id and field name as associated data. API responses and audit events show only the host.
- Requests carry `AidTrace-Delivery` (stable across retries), `AidTrace-Event` and `AidTrace-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<delivery id>.<raw body>")>`. Receivers should reject timestamps more than five minutes from their clock and delivery ids they have already accepted; `verifyWebhookSignature` in `server/notification-security.ts` is a reference implementation that checks the signature before recording the id.
- Every request uses explicit connect (TCP + TLS) and read timeouts. 2xx is delivered. Timeouts, connection errors, 408, 425, 429 and 5xx retry with capped exponential backoff and jitter, up to `NOTIFICATIONS_MAX_ATTEMPTS` (1–10, default 5) in total. Any other status fails without retry. Workers claim rows with `FOR UPDATE SKIP LOCKED` and a lease, so two workers never send the same claim, and a crashed worker's claim is retried within the same attempt budget.
- Only 307 and 308 redirects are followed, at most three hops, and each new target is re-validated and re-resolved against the same public-address rules before anything is sent. Other 3xx responses fail.
- A pending delivery can be cancelled by its endpoint owner or an admin. A delivery already in flight cannot be recalled.
- Blocked ranges include `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16` (including `169.254.169.254`), `172.16.0.0/12`, `192.168.0.0/16`, and the documentation, benchmarking, multicast and reserved IPv4 ranges. IPv6 targets must be global unicast (`2000::/3`), which excludes `::1`, `::`, IPv4-mapped forms, `fc00::/7` (including `fd00:ec2::254`), `fe80::/10` and multicast; 6to4, Teredo and documentation prefixes are also blocked.
- Delivery errors are recorded as stable codes such as `http_503`, `connect_timeout` or `blocked_address`. Signing secrets, target URLs, request bodies and driver error messages are not written to logs, error responses or audit events.

## Secret handling

Set distinct random values of at least 32 bytes for `SESSION_SECRET` and `PSEUDONYM_SECRET`. When notifications are enabled, `NOTIFICATIONS_ENCRYPTION_KEY` must also be at least 32 bytes and differ from both; startup fails otherwise. Rotating it makes existing endpoints unreadable, so they must be registered again. Production startup fails if `PSEUDONYM_SECRET` is missing or too short. Startup also fails, in any environment, if `SESSION_SECRET` and `PSEUDONYM_SECRET` are set to the same value. Only local `NODE_ENV=development` has a clearly marked fallback; configure an explicit key for any shared environment. Never expose these values through `VITE_*`, source control, logs, or issue reports.

## Known gaps

General per-IP/read rate limiting, last-admin protection, complete failure/rejection audit coverage, database-enforced append-only audit access, and explicit evidence of beneficiary consent are not implemented. Webhook receivers are responsible for their own replay storage, and email alerts are not implemented. Public records can still reveal amounts, dates, purposes, organization, and creator. A `verified` status does not establish identity, consent, purpose, or impact.

Report vulnerabilities privately using [SECURITY.md](../SECURITY.md). Use a dedicated test database and Stellar testnet for authorized checks; do not test against a live deployment without permission.
