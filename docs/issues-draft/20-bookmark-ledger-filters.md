# Restore Ledger Filters from the URL

**Complexity:** intermediate

## Context

Ledger filters are component state used to build API queries but are not encoded in browser location, so a filtered view cannot be bookmarked or shared. Affected users: reviewers, auditors, and support staff who share or bookmark filtered ledger views. Current behavior: filter state is local to the component; reloading or sharing the URL shows the unfiltered ledger. Expected behavior: supported filter keys are parsed from `URLSearchParams` on initial load; the URL is updated with `replaceState` on change without leaking session data. Evidence: `src/App.tsx` (ledger filter state) and `src/ledger-filters.ts` if extracted.

## Acceptance criteria

- A test loads a URL with valid filter query keys and asserts the visible filter state and the resulting query match.
- A test clears filters and asserts their query keys are removed from the URL.
- A test asserts no wallet/session token or private activity value appears in the URL after any filter interaction.
- `npx vitest run tests/ledger-filters.test.ts` passes.

## Files to touch

- `src/App.tsx`
- `src/ledger-filters.ts` (if extracted)
- `tests/ledger-filters.test.ts`

## Test expectations

- Run: `npx vitest run tests/ledger-filters.test.ts`
- Run: `npm run typecheck`
- No database required.

## Out of scope

Pagination cursors, beneficiary private-view URLs, or general routing replacement. This is URL state only, not the progressive pagination tracked by a separate open issue.

## Depends on

None
