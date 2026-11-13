# Add Filters to the Beneficiary Record View

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 1

## Problem statement

The beneficiary API accepts record filters, but the beneficiary screen renders its records without search, status, network, or date controls.

## Technical implementation requirements

- Add a small beneficiary-specific filter set and pass validated query parameters to `/api/beneficiary`.
- Reuse existing record filter semantics and preserve wallet-scoped authorization.

## Files and areas to touch

- `src/App.tsx`
- `server/records.ts` only if a filter contract gap is found
- `tests/api.test.ts` or `tests/backend.test.ts`

## Dependencies

- None. This is filtering, not the progressive pagination requested by existing GitHub issue #22.

## Measurable acceptance criteria

- A test selects a status and a date range and asserts the outgoing `/api/beneficiary` request carries those validated query parameters and that the rendered list matches the mocked filtered response.
- A test clears all filters and asserts the full set of the connected beneficiary wallet's records is restored.
- A test supplies filter input attempting to change the wallet scope and asserts the response remains scoped to the authenticated beneficiary wallet (any scope field is rejected or ignored).
- `npm test -- tests/api.test.ts tests/backend.test.ts` passes.

## Expected deliverables

- Beneficiary filter controls and focused filter/scope tests.

## How to set up and run tests

- `npm test -- tests/api.test.ts tests/backend.test.ts`
- `npm run typecheck`

## Out of scope

- Pagination redesign, public verification pages, or changes to beneficiary authorization.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: medium`.
