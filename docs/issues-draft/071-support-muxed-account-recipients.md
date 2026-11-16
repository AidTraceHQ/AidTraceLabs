# Support Muxed-Account (M-Address) Aid Recipients

**Complexity:** high

## Context

Recipient addresses are validated with `StrKey.isValidEd25519PublicKey` in `server/records.ts` (lines 131–133, used inside function `validateRecord` at lines 139–180), which accepts only G-addresses and rejects Stellar muxed accounts (`M...`). On the verification side, `operationDestination` in `server/stellar-verification.ts` (lines 85–92) reads only `to`, `destination`, and the create-account `account` field, never consulting `to_muxed`/`to_muxed_id`. Matching compares the destination to the recorded recipient by exact string equality (line 314). A payment sent to a muxed account verifies against the underlying base account only, silently discarding the muxed id. Affected: organizations and beneficiaries using muxed accounts, and reviewers relying on an exact recipient match. Note: `migrations/001_initial_schema.sql` (lines 77–94) stores `destination` as TEXT, so a muxed string can be persisted once validation and matching accept it.

## Acceptance criteria

- With a mocked `fetch`, a muxed record matches a payment whose `to_muxed` equals the recorded recipient.
- A muxed record does NOT match a payment addressed only to the bare base account.
- A G-address record behaves exactly as before (existing tests still pass).
- Record validation accepts a valid `M...` recipient and still rejects malformed addresses.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.

## Files to touch

- `server/records.ts`
- `server/stellar-verification.ts`
- `migrations/` (only if a column length or constraint must be widened)
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Test expectations

- Set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty; Horizon tests use mocked `fetch`.
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Muxed issuers beyond validation, a `to_muxed_id` routing UI, or changing the eligible operation-type set.

## Depends on

None
