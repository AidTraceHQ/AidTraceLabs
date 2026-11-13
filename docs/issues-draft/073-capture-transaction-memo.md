# Capture and Surface the Transaction Memo for Reconciliation

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 16 hours

**Release day:** Day 1

## Problem statement

Neither the verification input type nor the Horizon transaction shape carries a memo field (`server/stellar-verification.ts:4-12` and `server/stellar-verification.ts:29-34`), and `checkTransaction` never reads a transaction's `memo`/`memo_type` (`server/stellar-verification.ts:151-384`). The `verification_results` table has no memo column (`migrations/001_initial_schema.sql:77-94`). Stellar senders commonly tag a disbursement with a memo (an aid or reference id), so a reviewer cannot see or confirm the memo an organization used to tie a payment to its record. Affected: reviewers reconciling an on-chain payment against a record, and auditors wanting the on-chain reference. This is read-only capture only; the matching rule must not change.

## Technical implementation requirements

- Extend the Horizon transaction shape to read `memo` and `memo_type`, and carry the memo in the verification result without using it for matching.
- Persist the memo next to the existing verification fields (a new nullable column pair and a migration), leaving existing rows unaffected.
- Expose the memo through the existing `verification` object in the record API response and render it in the record detail view alongside the transaction hash.
- Apply the existing consent-aware projection so consent-off public views continue to withhold verification details (`server/records.ts:264-288`).
- Keep matching, status values, and reasons unchanged; `verified` still means only the payment fields match.
- Do NOT weaken the consent projection, add a dependency, or require a memo.

## Files and areas to touch

- `server/stellar-verification.ts`
- `server/records.ts`
- `migrations/` (new migration)
- `src/App.tsx`
- `tests/backend.test.ts`
- `docs/backend-design.md` and `docs/api.md`

## Dependencies

- None. Distinct from existing GitHub issue #17 and "Lock Down Horizon Failure-State Contracts" (neither reads the memo) and from "Show the Last Verification Check Time" (which only displays `checkedAt`).

## Measurable acceptance criteria

- A transaction with a memo yields a verification result carrying the memo and type; a transaction without a memo yields no memo and is still `verified` when all fields match.
- The memo round-trips through `POST /api/records/:id/verify` and appears in the record detail view.
- Consent-off public projections still withhold verification details (no memo leak).
- The new migration applies on a disposable database.
- `npm test -- tests/backend.test.ts`, `npm test -- tests/api.test.ts`, and `npm run typecheck` pass.

## Expected deliverables

- Memo capture in verification, a migration and persistence update, a detail-view display, and tests covering memo-present, memo-absent, and consent-off projections.

## How to set up and run tests

- To skip database integration locally, set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty in the shell, then run `npm test -- tests/backend.test.ts`; the Horizon tests use a mocked `fetch`.
- Run `npm run typecheck`.

## Out of scope

- Using the memo in matching, requiring a memo, verifying hashed-memo contents, or new memo-based filters.

## Suggested labels

- `area: backend`, `area: frontend`, `type: enhancement`, `difficulty: high`.
