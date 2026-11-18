# Use the Local Calendar Date for New Records

**Complexity:** beginner

## Context

The form initializes its date input from a UTC ISO string, which can display the previous or next calendar day for users in time zones offset from UTC (e.g. `America/New_York` or `Asia/Tokyo`). The same issue occurs when the form resets after a successful save. Affected users: anyone creating a new aid record from a time zone that differs from UTC. Current behavior: `new Date().toISOString().slice(0, 10)` returns a UTC date. Expected behavior: the date input should reflect the user's local calendar date. Evidence: `src/App.tsx` (form `useState` initializer) and `src/date.ts` if a helper exists.

## Acceptance criteria

- `npx vitest run tests/date.test.ts` passes and asserts that a date input initialized from local midnight equals the local calendar date for a UTC-negative zone (e.g. `America/New_York`) and a UTC-positive zone (e.g. `Asia/Tokyo`).
- A test that saves and then resets the form asserts the date input value is identical before and after, with no Ã‚Â±1 calendar-day shift.
- No server or schema change is introduced.

## Files to touch

- `src/App.tsx`
- `src/date.ts` (if extracting a reusable helper)
- `tests/date.test.ts`

## Test expectations

- Run: `npx vitest run tests/date.test.ts`
- Run: `npm run typecheck`
- No database setup required.

## Out of scope

Changing the record's stored date format or adding localization of all displayed dates.

## Depends on

None
