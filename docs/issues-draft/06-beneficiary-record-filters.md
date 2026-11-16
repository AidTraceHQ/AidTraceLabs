# Add Filters to the Beneficiary Record View

**Complexity:** medium

## Context

The `/api/beneficiary` endpoint accepts filter query parameters, but the beneficiary UI renders all records without search, status, network, or date controls. Affected users: beneficiaries with many records who need to find a specific disbursement. Current behavior: the beneficiary screen lists all records for the connected wallet with no filtering. Expected behavior: the beneficiary screen exposes filter controls that pass validated parameters to `/api/beneficiary`. Authorization must remain scoped to the authenticated wallet. Evidence: `src/App.tsx` (beneficiary table rendering) and `server/records.ts` (filter handling).

## Acceptance criteria

- A test selects a status and a date range and asserts the outgoing `/api/beneficiary` request carries those validated query parameters and the rendered list matches the mocked filtered response.
- A test clears all filters and asserts the full set of the connected beneficiary wallet's records is restored.
- A test supplies a filter value attempting to change the wallet scope and asserts the response remains scoped to the authenticated beneficiary wallet (any scope field is rejected or ignored).
- `npm test -- tests/api.test.ts tests/backend.test.ts` passes.

## Files to touch

- `src/App.tsx`
- `server/records.ts` (only if a filter contract gap is found)
- `tests/api.test.ts` or `tests/backend.test.ts`

## Test expectations

- Run: `npm test -- tests/api.test.ts tests/backend.test.ts`
- Run: `npm run typecheck`
- No database required for mocked filter parameter tests.

## Out of scope

Pagination redesign, public verification pages, or changes to beneficiary authorization.

## Depends on

None
