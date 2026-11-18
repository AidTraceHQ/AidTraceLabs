# Show Empty and Error States for the Wallet-Activity Table

**Complexity:** intermediate

## Context

The activity table in `src/App.tsx` renders `SkeletonRows` while loading and otherwise maps `filteredActivity` inside the `<tbody>` (lines 1412Ã¢â‚¬â€œ1415). There is no branch for "filters match nothing" and no branch for "the Horizon request failed". Both cases leave an empty `<tbody>` with no explanation. For comparison, the ledger renders `div.empty-state` (lines 1285Ã¢â‚¬â€œ1290) and the beneficiary table does the same (lines 1524Ã¢â‚¬â€œ1530). Affected: connected wallets reviewing their own activity. Current behavior: empty activity and failed loads both render an empty table with no message. Expected behavior: a distinct empty state appears when `filteredActivity` is empty and the load succeeded; a distinct error state with a Retry action appears when the load failed, reusing the existing `empty-state` styling.

## Acceptance criteria

- With a session connected and a filter matching no rows, the activity table body renders the empty-state message (not `SkeletonRows` and not an empty `<tbody>`).
- When `loadActivity` rejects (Horizon unreachable), the table renders the error state, and clicking Retry calls `loadActivity(session.address, network)` again.
- `npm run typecheck` and `npm test` exit 0.

## Files to touch

- `src/App.tsx`

## Test expectations

- Manual: run `npm run dev`, connect a testnet wallet, set a filter that matches nothing and confirm the empty state; block Horizon (offline) and confirm the error state and Retry action.
- Run: `npm run typecheck`
- Run: `npm test`

## Out of scope

Horizon pagination, request cancellation/timeout, and the global alert redesign.

## Depends on

None
