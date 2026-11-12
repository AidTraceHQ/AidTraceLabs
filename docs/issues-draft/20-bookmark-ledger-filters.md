# Restore Ledger Filters from the URL

**Publish:** Day 3

**Size:** Medium

## Problem statement

Ledger filters are component state used to build API queries, but are not encoded in browser location, so users cannot bookmark or share a filtered view.

## Technical requirements

- Parse supported filter keys from `URLSearchParams` on initial load.
- Update the URL with `replaceState` or navigation semantics without leaking session data.
- Keep invalid values on safe defaults and preserve existing debounce/request behavior.

## Files to touch

- `src/App.tsx`
- `src/ledger-filters.ts` (if extracted)
- `tests/ledger-filters.test.ts`

## Dependencies on other issues

- None. This is URL state, not the progressive pagination in #22.

## Acceptance criteria

- Reloading a valid filtered URL restores the same visible filter values/results.
- Clearing filters removes their query keys.
- Wallet/session tokens and private activity data never enter the URL.

## Deliverables

- URL-state helper and filter round-trip tests.

## How to run tests

- `npx vitest run tests/ledger-filters.test.ts`
- `npm run typecheck`

## Out of scope

- Pagination cursors, beneficiary private-view URLs, or general routing replacement.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: medium`.
