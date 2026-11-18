# Load Older Horizon Wallet Activity Pages

**Complexity:** advanced

## Context

Wallet activity fetches only 50 payment rows and 50 transaction rows and retains at most 100 merged entries in `src/App.tsx` (lines 392Ã¢â‚¬â€œ493). No Horizon cursor is retained or exposed to the UI, so older activity is inaccessible. Affected users: wallet holders with significant transaction history who cannot see payments older than the first page. Current behavior: activity is capped at the first Horizon page with no load-more action. Expected behavior: Horizon paging tokens are retained separately for payments and transactions; a "load older" action merges, deduplicates, and sorts the next bounded page; cursors reset on wallet/network change; stale responses from previous selections are ignored. Evidence: `src/App.tsx` (activity fetch and merge logic, lines 392Ã¢â‚¬â€œ493).

## Acceptance criteria

- The first page remains bounded and exposes a load-older control only when more data exists.
- Loading another page deduplicates payments also present in the transaction response.
- Switching wallet/network prevents old pages from appearing in the new activity view.
- The control remains usable at narrow mobile widths.

## Files to touch

- `src/App.tsx`
- `src/activity.ts` (if extracting cursor/merge behavior)
- `tests/activity.test.ts`
- `src/index.css` or `src/fullstack.css` (only for the control's responsive placement)

## Test expectations

- Run: `npx vitest run tests/activity.test.ts` with mocked Horizon responses.
- Run: `npm run typecheck`, `npm run lint`, `npm run build`

## Out of scope

Server-side API pagination (tracked by a separate open issue), scheduled reverification, or changes to Stellar payment matching.

## Depends on

None
