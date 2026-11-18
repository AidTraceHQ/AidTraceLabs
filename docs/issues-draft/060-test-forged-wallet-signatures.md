# Test Forged Wallet Signatures and Challenge Mismatches

**Complexity:** intermediate

## Context

Wallet identity rests on SEP-53 signature verification in `server/auth.ts` (function `verifySep53Signature`, lines 83Ã¢â‚¬â€œ91) and on matching the submitted address and network to the stored challenge (lines 257Ã¢â‚¬â€œ259). The existing unit test only checks an altered message and a non-signature string in `tests/backend.test.ts` (lines 14Ã¢â‚¬â€œ35). Nothing asserts that a signature produced by a different keypair, or a valid signature submitted with a mismatched address/network, is rejected. Affected: any organization or beneficiary whose identity could be forged if this check regressed.

## Acceptance criteria

- A unit test where wallet B signs wallet A's challenge message asserts `verifySep53Signature(A, message, signature)` returns `false`.
- An integration test that submits a correct signature with a mismatched `address` or `network` asserts 401.
- Cases for the malformed `challengeId` and over-length `signature` guards (lines 216Ã¢â‚¬â€œ223) are covered.
- A correct signature still verifies and creates a session.
- `npm test -- tests/backend.test.ts` passes; `npm run typecheck` passes.

## Files to touch

- `tests/backend.test.ts`
- `docs/security.md` (optional one-line coverage note)

## Test expectations

- For the unit case: `npm test -- tests/backend.test.ts` (the SEP-53 block needs no database).
- For integration: configure `TEST_DATABASE_URL`/`TEST_DATABASE_BRANCH=test`, rerun the same file.
- Run: `npm run typecheck`

## Out of scope

New signature schemes, key management, or changing the five-minute challenge TTL.

## Depends on

None
