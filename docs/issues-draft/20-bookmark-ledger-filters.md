# Restore Ledger Filters from the URL

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 3

## Problem statement

Ledger filters are component state used to build API queries, but are not encoded in browser location, so users cannot bookmark or share a filtered view.

## Technical implementation requirements

- Parse supported filter keys from `URLSearchParams` on initial load.
- Update the URL with `replaceState` or navigation semantics without leaking session data.
- Keep invalid values on safe defaults and preserve existing debounce/request behavior.

## Files and areas to touch

- `src/App.tsx`
- `src/ledger-filters.ts` (if extracted)
- `tests/ledger-filters.test.ts`

## Dependencies

- None. This is URL state, not the progressive pagination in existing GitHub issue #22.

## Measurable acceptance criteria

- A test loads a URL with valid filter query keys and asserts the visible filter state and the resulting query match.
- A test clears filters and asserts their query keys are removed from the URL.
- A test asserts no wallet/session token or private activity value appears in the URL after any filter interaction.
- `npx vitest run tests/ledger-filters.test.ts` passes.

## Expected deliverables

- URL-state helper and filter round-trip tests.

## How to set up and run tests

- `npx vitest run tests/ledger-filters.test.ts`
- `npm run typecheck`

## Out of scope

- Pagination cursors, beneficiary private-view URLs, or general routing replacement.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: medium`.
