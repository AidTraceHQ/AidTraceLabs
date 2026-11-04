# Cursor Pagination UI

**Complexity:** medium

## Context

The API uses signed cursor pagination, while the current client helper can collect all pages. A progressive UI can reduce large responses and improve responsiveness.

## Acceptance criteria

- Add explicit next-page loading for ledger and admin lists where useful.
- Reset cursors when filters or sort order change.
- Preserve loading, retry, empty, and end-of-list states.
- Avoid exposing or constructing cursor contents in the UI.

## Files to touch

- `src/api.ts`
- `src/App.tsx`
- `src/fullstack.css`
- `tests/api.test.ts`

## Test expectations

- Cover next-page requests, filter reset, duplicate prevention, errors, and end-of-list behavior.
- Run `npm run check`.
