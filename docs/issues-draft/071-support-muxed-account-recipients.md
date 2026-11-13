# Support Muxed-Account (M-Address) Aid Recipients

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 16 hours

**Release day:** Day 2

## Problem statement

Recipient addresses are validated with `StrKey.isValidEd25519PublicKey`, which accepts only G-addresses and rejects Stellar muxed accounts (`M...`), so a record can never store a muxed recipient (`server/records.ts:131-133`, applied inside `validateRecord` at `server/records.ts:139-180`). On the verification side, `operationDestination` reads only `to`, `destination`, and the create-account `account` field and never consults `to_muxed`/`to_muxed_id` (`server/stellar-verification.ts:85-92`), while matching compares the destination to the recorded recipient by exact string equality (`server/stellar-verification.ts:314`). A payment sent to a muxed account therefore verifies against the underlying base account only, silently discarding the muxed id that identifies the intended recipient. Affected: organizations and beneficiaries using muxed accounts, and reviewers relying on an exact recipient match. `migrations/001_initial_schema.sql:77-94` stores `destination` as TEXT, so a muxed string can be persisted once validation and matching accept it.

## Technical implementation requirements

- Accept muxed public accounts for the recipient address only, using the SDK's muxed-account predicate in addition to the existing G-address check; keep `assetIssuer` restricted to G-addresses and keep rejecting arbitrary strings.
- In `operationDestination`, when the recorded recipient is a muxed address, compare against the operation's `to_muxed` value, and record the muxed destination in the verification result.
- Define the matching rule precisely: a record stored with a muxed recipient matches only a payment whose operation reports the same muxed destination (the base account alone is not sufficient); a record stored with a G-address continues to match the base `to` field exactly as today.
- Do NOT weaken any existing reject rule, do not introduce a dependency upgrade, and do not change status values.
- Document the rule in `docs/backend-design.md`.

## Files and areas to touch

- `server/records.ts`
- `server/stellar-verification.ts`
- `migrations/` (only if a column length or constraint must be widened)
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Dependencies

- None. Distinct from existing GitHub issue #17 (multi-operation transaction coverage) and from "Lock Down Horizon Failure-State Contracts" (failure-state contract tests).

## Measurable acceptance criteria

- With a mocked `fetch`, a muxed record matches a payment whose `to_muxed` equals the recorded recipient.
- A muxed record does NOT match a payment addressed only to the bare base account.
- A G-address record behaves exactly as before (existing tests still pass).
- Record validation accepts a valid `M...` recipient and still rejects malformed addresses.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.

## Expected deliverables

- Validation, destination extraction, and matching updates, a migration only if required, and mocked tests covering muxed and non-muxed recipients.

## How to set up and run tests

- To skip database integration locally, set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty in the shell, then run `npm test -- tests/backend.test.ts`; the Horizon tests use a mocked `fetch`.
- Run `npm run typecheck`.

## Out of scope

- Muxed _issuers_ beyond validation, a `to_muxed_id` routing UI, or changing the eligible operation-type set.

## Suggested labels

- `area: backend`, `type: enhancement`, `difficulty: high`.
