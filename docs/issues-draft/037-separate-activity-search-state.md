# Separate Activity Search from Ledger Search

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 3

## Problem statement

The public ledger and wallet activity search inputs both bind to the same `search` state (`src/App.tsx:214-226,1144,1360-1361`). Searching activity therefore also changes the ledger query and leaves the public ledger filtered when the user switches views.

## Technical implementation requirements

- Add a dedicated activity search state and use it only in `filteredActivity`.
- Keep public-ledger search bound to the existing ledger state and URL/filter behavior.
- Avoid introducing cross-view search persistence unless separately designed.

## Files and areas to touch

- `src/App.tsx`
- `src/activity-filters.ts` (pure activity filtering helper)
- `tests/activity-filters.test.ts`

## Dependencies

- None. This is separate from prior draft #20, which persists ledger filters in the URL.

## Measurable acceptance criteria

- Typing in activity search does not change the ledger search input or API query.
- Typing in ledger search does not change activity search results.
- Switching tabs preserves each view's own search state.

## Expected deliverables

- Independent state, extracted pure activity filtering helper, and regression tests for cross-view isolation.

## How to set up and run tests

- Run `npx vitest run tests/activity-filters.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- Cursor pagination (#22), search ranking, or changing server filter semantics.

## Suggested labels

- `area: frontend`, `type: bug`, `difficulty: medium`.
