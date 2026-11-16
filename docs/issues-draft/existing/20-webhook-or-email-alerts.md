# Webhook or Email Alerts

**Complexity:** high

## Context

There is no outbound notification capability. A repository-wide search finds no webhook,
email or notification code under `server/`, and `.env.example` defines no transport
configuration. Users only learn that a record or its verification status changed by
reloading the app.

Affected users: organizations and admins who want to be told when a record changes or a
verification flips. Expected behavior: an opt-in delivery model with a defined
recipient-verification policy that never discloses beneficiary data by default. Decision
required first (delivery model and recipient-verification policy).

## Acceptance criteria

- The delivery model and recipient-verification policy are chosen and documented before
  implementation.
- Delivery targets are authenticated and revocable endpoints, or verified email addresses;
  secrets are stored encrypted or as hashes, never in plain text.
- Webhook deliveries are signed, replay is rejected, retries are bounded and safe, and a
  pending delivery can be cancelled.
- Outbound requests block SSRF: the resolved target must be a public address, and
  loopback, private, link-local, unique-local and cloud-metadata ranges (for example
  `127.0.0.0/8`, `10.0.0.0/8`, `169.254.0.0/16`, `::1`) are rejected before the request
  is sent and re-checked after any redirect.
- Every outbound delivery uses explicit connect and read timeouts and a bounded retry
  budget with backoff.
- Secrets are never logged: signing keys, target credentials, tokens and full request
  payloads never appear in logs, error messages or audit events.
- Event payloads are minimized: no raw wallet address, note, or beneficiary name is sent by
  default.
- When delivery is unconfigured or disabled, the API behaves exactly as it does today (no
  new failure mode).
- `npm run check` passes.

## Files to touch

- `server/` (focused notification service)
- `migrations/`
- `.env.example`
- `tests/backend.test.ts`
- `docs/security.md`
- `docs/deployment.md`

## Test expectations

- Cover authorization, signature verification, bounded retries, replay rejection,
  payload redaction, and the disabled/unconfigured path.
- Use a local mock transport; never send a real email or webhook in tests.
- Run `npm run check`.

## Out of scope

Selecting a production vendor or provider account, and any real message delivery from the
test suite.

## Depends on

None
