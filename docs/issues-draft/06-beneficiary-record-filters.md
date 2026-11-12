# Add Filters to the Beneficiary Record View

**Publish:** Day 1

**Size:** Medium

## Problem statement

The beneficiary API accepts record filters, but the beneficiary screen renders its records without search, status, network, or date controls.

## Technical requirements

- Add a small beneficiary-specific filter set and pass validated query parameters to `/api/beneficiary`.
- Reuse existing record filter semantics and preserve wallet-scoped authorization.

## Files to touch

- `src/App.tsx`
- `server/records.ts` only if a filter contract gap is found
- `tests/api.test.ts` or `tests/backend.test.ts`

## Dependencies on other issues

- None. This is filtering, not the progressive pagination requested by #22.

## Acceptance criteria

- Beneficiaries can filter their own records by status and date and search record text.
- Clearing filters restores all records for the connected beneficiary wallet.
- No filter can change the server-side wallet scope.

## Deliverables

- Beneficiary filter controls and focused filter/scope tests.

## How to run tests

- `npm test -- tests/api.test.ts tests/backend.test.ts`
- `npm run typecheck`

## Out of scope

- Pagination redesign, public verification pages, or changes to beneficiary authorization.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: medium`.
