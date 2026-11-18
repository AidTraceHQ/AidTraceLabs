# Capture and Surface the Transaction Memo for Reconciliation

**Complexity:** advanced

## Context

Neither the verification input type nor the Horizon transaction shape carries a memo field in `server/stellar-verification.ts` (types at lines 4Ã¢â‚¬â€œ12 and 29Ã¢â‚¬â€œ34), and `checkTransaction` (lines 151Ã¢â‚¬â€œ384) never reads `memo`/`memo_type`. The `verification_results` table has no memo column in `migrations/001_initial_schema.sql` (lines 77Ã¢â‚¬â€œ94). Stellar senders commonly tag disbursements with a memo (an aid or reference id), so a reviewer cannot see or confirm the memo an organization used to tie a payment to its record. Affected: reviewers reconciling an on-chain payment against a record, and auditors wanting the on-chain reference. This is read-only capture only; the matching rule must not change. Privacy: the existing consent-aware projection must continue to withhold verification details on consent-off public views (`server/records.ts`, function `recordSelect`, lines 264Ã¢â‚¬â€œ288).

## Acceptance criteria

- A transaction with a memo yields a verification result carrying the memo and type; a transaction without a memo yields no memo and is still `verified` when all fields match.
- The memo round-trips through `POST /api/records/:id/verify` and appears in the record detail view.
- Consent-off public projections still withhold verification details (no memo leak).
- The new migration applies on a disposable database.
- `npm test -- tests/backend.test.ts`, `npm test -- tests/api.test.ts`, and `npm run typecheck` pass.

## Files to touch

- `server/stellar-verification.ts`
- `server/records.ts`
- `migrations/` (new migration)
- `src/App.tsx`
- `tests/backend.test.ts`
- `docs/backend-design.md`
- `docs/api.md`

## Test expectations

- Set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty; Horizon tests use mocked `fetch`.
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm test -- tests/api.test.ts`
- Run: `npm run typecheck`

## Out of scope

Using the memo in matching, requiring a memo, verifying hashed-memo contents, or new memo-based filters.

## Depends on

None
