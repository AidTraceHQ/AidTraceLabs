# Separate Activity Search from Ledger Search

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 3

## Problem statement

The public-ledger search input (the "Search records" `search` field at `src/App.tsx:1144`) and the wallet activity search input (aria-label "Search activity" at `src/App.tsx:1360-1361`) both bind to the same `search` state declared at `src/App.tsx:214-226`. Searching activity therefore also changes the ledger query and leaves the public ledger filtered when the user switches views.

## Technical implementation requirements

- Add a dedicated activity search state and use it only in `filteredActivity`.
- Keep public-ledger search bound to the existing ledger state and URL/filter behavior.
- Avoid introducing cross-view search persistence unless separately designed.

## Files and areas to touch

- `src/App.tsx`
- `src/activity-filters.ts` (pure activity filtering helper)
- `tests/activity-filters.test.ts`

## Dependencies

- None. This is separate from prior draft "Restore Ledger Filters from the URL", which persists ledger filters in the URL.

## Measurable acceptance criteria

- Test `typing in activity search does not change the ledger search or query` in `tests/activity-filters.test.ts` asserts the ledger query string is unchanged.
- Test `typing in ledger search does not change activity results` asserts the activity result list is unchanged.
- Test `switching views preserves each view's own search` asserts the ledger and activity search values remain independent.
- `npx vitest run tests/activity-filters.test.ts` and `npm run typecheck` pass.

## Expected deliverables

- Independent state, extracted pure activity filtering helper, and regression tests for cross-view isolation.

## How to set up and run tests

- Run `npx vitest run tests/activity-filters.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- Cursor pagination (existing GitHub issue #22), search ranking, or changing server filter semantics.

## Suggested labels

- `area: frontend`, `type: bug`, `difficulty: medium`.
