# Test Forged Wallet Signatures and Challenge Mismatches

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 1

## Problem statement

Wallet identity rests on SEP-53 signature verification (`server/auth.ts:83-91`) and on matching the submitted address and network to the stored challenge (`server/auth.ts:257-259`). The existing unit test only checks an altered message and a non-signature string (`tests/backend.test.ts:14-35`), and the integration login always uses the correct wallet. Nothing asserts that a signature produced by a _different_ keypair, or a valid signature submitted with a mismatched address/network, is rejected. Affected: any organization or beneficiary whose identity could be forged if this check regressed.

## Technical implementation requirements

- Add a unit test where wallet B signs wallet A's challenge message; assert `verifySep53Signature(A, message, signature)` returns `false`.
- Add an integration test that submits a correct signature with a mismatched `address` or `network` and asserts 401 (`server/auth.ts:257-259`).
- Add cases for the malformed `challengeId` and over-length `signature` guards (`server/auth.ts:216-223`).
- Do NOT change the verification algorithm, the challenge message format, the signing library, or the challenge TTL.

## Files and areas to touch

- `tests/backend.test.ts`
- `docs/security.md` (optional one-line coverage note)

## Dependencies

- The mismatch integration cases need a test database; the SEP-53 unit case does not.

## Measurable acceptance criteria

- Different-keypair and address/network-mismatch cases return `false` and 401 respectively.
- A correct signature still verifies and creates a session.
- `npm test -- tests/backend.test.ts` passes; `npm run typecheck` passes.

## Expected deliverables

- New unit and integration signature-forgery tests.

## How to set up and run tests

- For the unit case: `npm test -- tests/backend.test.ts` (the SEP-53 block needs no database).
- For integration: configure `TEST_DATABASE_URL`/`TEST_DATABASE_BRANCH=test`, rerun the same file, then `npm run typecheck`.

## Out of scope

- New signature schemes, key management, or changing the five-minute challenge TTL.

## Suggested labels

- `area: security`, `area: testing`, `type: enhancement`, `difficulty: medium`.
