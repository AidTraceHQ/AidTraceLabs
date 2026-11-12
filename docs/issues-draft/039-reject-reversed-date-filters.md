# Validate Reversed Date-Filter Ranges

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 4

## Problem statement

Record filters validate `from` and `to` separately but accept a `from` date later than `to` (`server/records.ts:522-564`). Users get an empty result without being told the range is invalid; the activity view also accepts independent dates (`src/App.tsx:1378-1387`).

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

- None. This is filter validation, not URL persistence (#20).

## Measurable acceptance criteria

- Equal and ascending ranges remain valid.
- Reversed ranges return a clear validation response and do not run the record query.
- Empty start/end values continue to mean unbounded on that side.

## Expected deliverables

- Server range validation, client activity feedback, and boundary tests.

## How to set up and run tests

- Run `npm test -- tests/backend.test.ts` with DB integration disabled for unit/API filters.
- Run `npm run typecheck`.

## Out of scope

- Date localization, changing stored dates, or adding filters to new views.

## Suggested labels

- `area: backend`, `area: frontend`, `type: bug`, `difficulty: medium`.
