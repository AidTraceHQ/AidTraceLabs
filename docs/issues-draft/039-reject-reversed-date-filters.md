# Validate Reversed Date-Filter Ranges

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 4

## Problem statement

The `from`/`to` handling inside `applyRecordFilters` validates each date separately but accepts a `from` later than `to` (`server/records.ts:522-564`). Users get an empty result without being told the range is invalid; the activity view's From/To inputs (`activityFrom`/`activityTo`, `src/App.tsx:1378-1387`) also accept independent dates.

## Technical implementation requirements

- Validate `from <= to` for public/beneficiary record filters and wallet activity filters.
- Return a field-specific safe validation error from API routes and an inline client message for local activity filtering.
- Preserve valid one-sided ranges and ISO `YYYY-MM-DD` semantics.

## Files and areas to touch

- `server/records.ts`
- `src/App.tsx`
- `tests/backend.test.ts`
- `tests/` (date-filter helper test if extracted)

## Dependencies

- None. This is filter validation, not URL persistence ("Restore Ledger Filters from the URL").

## Measurable acceptance criteria

- Test asserts `GET /api/transparency?from=2026-02-01&to=2026-01-01` returns HTTP `400` with a field-specific message and performs no record list query.
- Test asserts equal (`from == to`) and ascending ranges return HTTP `200`.
- Client activity filtering shows an inline invalid-range message and filters nothing when `activityFrom > activityTo`.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.

## Expected deliverables

- Server range validation, client activity feedback, and boundary tests.

## How to set up and run tests

- Run `npm test -- tests/backend.test.ts` with DB integration disabled for unit/API filters.
- Run `npm run typecheck`.

## Out of scope

- Date localization, changing stored dates, or adding filters to new views.

## Suggested labels

- `area: backend`, `area: frontend`, `type: bug`, `difficulty: medium`.
