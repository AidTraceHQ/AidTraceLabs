# Validate Reversed Date-Filter Ranges

**Complexity:** intermediate

## Context

The `from`/`to` handling inside `applyRecordFilters` in `server/records.ts` (lines 522Ã¢â‚¬â€œ564) validates each date separately but accepts a `from` later than `to`. Users receive an empty result without an explanation. The activity view's `activityFrom`/`activityTo` inputs in `src/App.tsx` (lines 1378Ã¢â‚¬â€œ1387) also accept independent dates with no cross-validation. Affected users: reviewers applying date filters who see empty results with no indication the range is inverted. Current behavior: a reversed date range silently returns no results on the API and no message in the client. Expected behavior: the API returns `400` with a field-specific message for `from > to`; the client activity view shows an inline invalid-range message and filters nothing.

## Acceptance criteria

- A test asserts `GET /api/transparency?from=2026-02-01&to=2026-01-01` returns HTTP `400` with a field-specific message and performs no record list query.
- A test asserts equal (`from == to`) and ascending ranges return HTTP `200`.
- Client activity filtering shows an inline invalid-range message and filters nothing when `activityFrom > activityTo`.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.

## Files to touch

- `server/records.ts`
- `src/App.tsx`
- `tests/backend.test.ts`
- `tests/` (date-filter helper test if extracted)

## Test expectations

- Run: `npm test -- tests/backend.test.ts` with database integration disabled for unit/API filter tests.
- Run: `npm run typecheck`

## Out of scope

Date localization, changing stored dates, or adding filters to new views.

## Depends on

None
