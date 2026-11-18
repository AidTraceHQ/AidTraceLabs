# Separate Activity Search from Ledger Search

**Complexity:** intermediate

## Context

The public-ledger search input (the "Search records" field at `src/App.tsx`, line 1144) and the wallet activity search input (`aria-label="Search activity"` at `src/App.tsx`, lines 1360Ã¢â‚¬â€œ1361) both bind to the same `search` state declared at `src/App.tsx` (lines 214Ã¢â‚¬â€œ226). Searching the activity view therefore also changes the ledger query, leaving the public ledger filtered when the user switches tabs. Affected users: any connected wallet holder who searches activity and then returns to the public ledger. Current behavior: a single `search` state drives both filter inputs; activity search and ledger search are coupled. Expected behavior: a dedicated activity search state is used only by `filteredActivity`; the public-ledger search remains bound to the existing state and URL/filter behavior.

## Acceptance criteria

- Test `typing in activity search does not change the ledger search or query` in `tests/activity-filters.test.ts` asserts the ledger query string is unchanged.
- Test `typing in ledger search does not change activity results` asserts the activity result list is unchanged.
- Test `switching views preserves each view's own search` asserts the ledger and activity search values remain independent.
- `npx vitest run tests/activity-filters.test.ts` and `npm run typecheck` pass.

## Files to touch

- `src/App.tsx`
- `src/activity-filters.ts` (pure activity filtering helper)
- `tests/activity-filters.test.ts`

## Test expectations

- Run: `npx vitest run tests/activity-filters.test.ts`
- Run: `npm run typecheck`
- No database required.

## Out of scope

Cursor pagination (tracked by a separate open issue), search ranking, or changing server filter semantics. This is separate from "Restore Ledger Filters from the URL", which persists ledger filters in the URL.

## Depends on

None
