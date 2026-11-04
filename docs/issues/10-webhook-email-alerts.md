# Webhook or Email Alerts

**Complexity:** high

## Context

Users may want notification when a record changes or verification status changes. No notification delivery service is currently configured.

## Acceptance criteria

- Select a delivery model and recipient-verification policy before implementation.
- Use authenticated, revocable endpoints or verified email addresses; store secrets encrypted or as hashes where possible.
- Sign webhooks, protect against replay, retry safely, and support delivery cancellation.
- Minimize event payloads so beneficiary data is not disclosed by default.

## Files to touch

- `server/` notification service
- `migrations/`
- `.env.example`
- `tests/backend.test.ts`
- `docs/security.md` and `docs/deployment.md`

## Test expectations

- Cover authorization, signature verification, retries, replay protection, redaction, and disabled delivery.
- Use a local mock transport; do not send real email/webhooks in tests.
