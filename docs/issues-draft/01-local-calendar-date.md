# Use the Local Calendar Date for New Records

**Publish:** Day 1

**Size:** Trivial

## Problem statement

The form initializes its date from a UTC ISO string, which can show the previous or next calendar day for users in some time zones.

## Technical requirements

- Derive the date input value from local year, month, and day components.
- Use the same helper when resetting the form after save.

## Files to touch

- `src/App.tsx`
- `src/date.ts` (if extracting a reusable helper)
- `tests/date.test.ts`

## Dependencies on other issues

- None.

## Acceptance criteria

- A date input initialized at local midnight matches the user's local calendar date in UTC-negative and UTC-positive zones.
- Saving and reopening/resetting the form does not shift the date.

## Deliverables

- Date helper and focused timezone tests; no server or schema change.

## How to run tests

- `npx vitest run tests/date.test.ts`
- `npm run typecheck`

## Out of scope

- Changing the record's stored date format or localization of all displayed dates.

## Suggested labels

- `area: frontend`, `type: bug`, `difficulty: trivial`.
