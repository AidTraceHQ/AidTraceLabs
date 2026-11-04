# Beneficiary Wallet Acknowledgment

**Complexity:** high

## Context

Beneficiary consent is currently a record field and is not backed by a signed acknowledgment. Explore wallet-signature evidence without implying that wallet control establishes legal identity or informed consent.

## Acceptance criteria

- Define the exact statement, expiry/revocation model, and versioned consent text before implementation.
- Require a fresh, domain-bound wallet signature; never request a private key.
- Store minimal auditable evidence and expose no signature or wallet unless policy permits it.
- Make withdrawal and historical-record behavior explicit.

## Files to touch

- `server/auth.ts`
- `server/records.ts`
- `migrations/`
- `src/App.tsx`
- `tests/backend.test.ts`
- `docs/security.md`

## Test expectations

- Cover valid/invalid/expired/replayed signatures, revocation, authorization, and public projection.
- Run `npm run check` and obtain product/privacy review before enabling.
