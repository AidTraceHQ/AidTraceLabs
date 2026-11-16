# Beneficiary Wallet Acknowledgment

**Complexity:** high

## Context

Consent is stored as a plain boolean today: the `recipient_consent` column
(`server/records.ts:59`, selected at `server/records.ts:241`) is set from a UI checkbox
("I have explicit consent to publish …", `src/App.tsx:1877` and `src/App.tsx:2114`). It is
not backed by a signed acknowledgment from the beneficiary's wallet. The login flow already
verifies SEP-53 wallet signatures — `verifySep53Signature()` (`server/auth.ts:83`), used by
`POST /api/auth/verify` (`server/auth.ts:209`) — so the signing primitive is available.

Affected users: beneficiaries whose consent is asserted by an operator, and reviewers who
cannot tell whether consent was given by the beneficiary. Expected behavior: a versioned,
domain-bound acknowledgment evidencing consent, without implying that wallet control
establishes legal identity or informed consent. Decision required first (statement text,
expiry and revocation model).

## Acceptance criteria

- The exact consent statement is versioned, and the version used is stored with every
  acknowledgment.
- An acknowledgment requires a fresh, domain-bound wallet signature; the private key is
  never requested.
- Only minimal auditable evidence is stored; the raw signature and wallet are not exposed
  unless policy explicitly permits it.
- Expiry and revocation are defined and enforced, and the behaviour for records created
  before the change is explicit.
- The public projection is unchanged or stricter than `publicRecord()`
  (`server/records.ts:264`); a record without an acknowledgment is projected no more
  permissively than today.
- Which fields are public is stated explicitly, and a consent-off record stays hidden: an
  acknowledgment never widens the projection beyond the current public set (record id,
  network, asset, amount, status, date, organization name, verification outcome and checked
  fields). The recipient name, recipient wallet, transaction hash, note and verification
  destination/link/ledger remain withheld whenever `recipient_consent` is false.
- `npm run check` passes, and product/privacy review is obtained before the feature is
  enabled.

## Files to touch

- `server/auth.ts`
- `server/records.ts`
- `migrations/`
- `src/App.tsx`
- `tests/backend.test.ts`
- `docs/security.md`

## Test expectations

- Cover valid, invalid, expired and replayed signatures, revocation, authorization, and the
  public projection with and without an acknowledgment.
- Run `npm run check`.

## Out of scope

Legal-identity verification, KYC, and encrypting beneficiary PII.

## Depends on

None
