# Use the Local Calendar Date for New Records

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 3 hours

**Release day:** Day 1

## Problem statement

The form initializes its date from a UTC ISO string, which can show the previous or next calendar day for users in some time zones.

## Technical implementation requirements

- Derive the date input value from local year, month, and day components.
- Use the same helper when resetting the form after save.

## Files and areas to touch

- `src/App.tsx`
- `src/date.ts` (if extracting a reusable helper)
- `tests/date.test.ts`

## Dependencies

- None.

## Measurable acceptance criteria

- `npx vitest run tests/date.test.ts` passes and asserts that a date input initialized from local midnight equals the local calendar date for a UTC-negative zone (e.g. `America/New_York`) and a UTC-positive zone (e.g. `Asia/Tokyo`).
- A test that saves and then re-opens/resets the form asserts the date input value is identical before and after, with no +-1 calendar-day shift.

## Expected deliverables

- Date helper and focused timezone tests; no server or schema change.

## How to set up and run tests

- `npx vitest run tests/date.test.ts`
- `npm run typecheck`

## Out of scope

- Changing the record's stored date format or localization of all displayed dates.

## Suggested labels

- `area: frontend`, `type: bug`, `difficulty: trivial`.
