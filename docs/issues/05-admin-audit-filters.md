# Admin Audit Viewer Filters

**Complexity:** medium

## Context

The admin audit view currently supports action and text filtering. Add direct filters for the API's existing address and record-ID parameters to make investigations less dependent on free-text matching.

## Acceptance criteria

- Add address and record ID filters with clear/reset controls.
- Keep filters synchronized with the API query and cursor reset behavior.
- Preserve server-side admin authorization and avoid fetching unrelated audit rows.

## Files to touch

- `src/App.tsx`
- `server/records.ts` only if filter semantics need correction
- `tests/api.test.ts`, `tests/backend.test.ts`

## Test expectations

- Cover each filter alone and in combination, empty results, and access denial.
- Confirm changing a filter restarts pagination from the first page.
- Run `npm run check`.
