# Show empty and error states for the wallet-activity table

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 1

## Problem statement

The activity table renders `SkeletonRows` only while loading and otherwise maps `filteredActivity` inside the
`<tbody>` (`src/App.tsx:1412-1415`). There is no branch for "filters match nothing" and no branch for "the
Horizon request failed", so both cases leave an empty `<tbody>` with no explanation. Filter reasons are
surfaced only through the shared global alert (`div.alert.error`, `src/App.tsx:1026-1034`), which is also used
by unrelated flows. Compare the ledger's `div.empty-state` (`src/App.tsx:1285-1290`) and the beneficiary table's
`div.empty-state` (`src/App.tsx:1524-1530`). Affected: connected wallets reviewing their own activity.

## Technical implementation requirements

- Add a distinct empty state ("No activity matches these filters") shown when `filteredActivity` is
  empty and the load succeeded.
- Add a distinct error state with a Retry action shown when the activity load failed; reuse the
  existing `empty-state` styling and the `RefreshCw` activity Refresh button already used at
  `src/App.tsx:1390-1396`.
- Keep the existing columns and the per-row "View record" button (`src/App.tsx:1424-1434`).
- Do not change `loadActivity` request logic (`src/App.tsx:392-476`) beyond exposing whether it
  failed; request lifecycle hardening is tracked separately.

## Files and areas to touch

- `src/App.tsx`

## Dependencies

- None. Existing GitHub issue #21 (browser E2E tests) and the activity request-lifecycle draft are separate.

## Measurable acceptance criteria

- With a session connected and a filter matching no `filteredActivity` rows, the activity table body renders
  the empty-state message (not `SkeletonRows` and not an empty `<tbody>`).
- When `loadActivity` rejects (Horizon unreachable), the table renders the error state, and clicking Retry
  calls `loadActivity(session.address, network)` again.
- `npm run typecheck` and `npm test` exit 0.

## Expected deliverables

- Empty and error states for the activity table, with a retry action.

## How to set up and run tests

- Run `npm run dev`, connect a testnet wallet with activity, then set a filter that matches nothing
  and confirm the empty state; block Horizon (offline) and confirm the error state.

## Out of scope

- Horizon pagination, request cancellation/timeout, and the global alert redesign.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: medium`
