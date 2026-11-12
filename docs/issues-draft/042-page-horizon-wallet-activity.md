# Load Older Horizon Wallet Activity Pages

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 16 hours

**Release day:** Day 2

## Problem statement

Wallet activity fetches only 50 payment rows and 50 transaction rows and retains at most 100 merged entries (`src/App.tsx:392-493`). No Horizon cursor is retained or exposed to the UI, so older activity is inaccessible.

## Technical implementation requirements

- Retain the Horizon paging tokens separately for payments and transactions.
- Add an explicit “load older” action that merges, deduplicates, and sorts the next bounded page without losing live updates.
- Reset cursors on wallet/network change and ignore stale responses from previous selections.
- Keep the public ledger's signed cursor API behavior unchanged.

## Files and areas to touch

- `src/App.tsx`
- `src/activity.ts` (if extracting cursor/merge behavior)
- `tests/activity.test.ts`
- `src/index.css` or `src/fullstack.css` only for the control's responsive placement

## Dependencies

- None. Existing issue #22 concerns AidTrace ledger/admin pagination; this is the separate Horizon wallet-activity stream.

## Measurable acceptance criteria

- The first page remains bounded and exposes a load-older control only when more data exists.
- Loading another page deduplicates payments also present in the transaction response.
- Switching wallet/network prevents old pages from appearing in the new activity view.
- The control remains usable at narrow mobile widths.

## Expected deliverables

- Horizon cursor state, bounded merge UI, desktop/mobile screenshots using test data, and cursor/race tests.

## How to set up and run tests

- Run `npx vitest run tests/activity.test.ts` with mocked Horizon responses.
- Run `npm run typecheck`, `npm run lint`, and `npm run build`.

## Out of scope

- Server-side API pagination, scheduled reverification, or changes to Stellar payment matching.

## Suggested labels

- `area: frontend`, `area: testing`, `type: enhancement`, `difficulty: high`.
