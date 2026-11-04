# Dashboard Totals

**Complexity:** medium

## Context

The transparency API returns totals grouped by status and asset. Improve presentation while keeping the distinction between record totals and verified payment amounts clear.

## Acceptance criteria

- Display totals grouped by asset and verification status using the active filters.
- Label amounts as record totals, not proof of recipient use or impact.
- Handle empty results and large numeric values without floating-point corruption.

## Files to touch

- `src/App.tsx`
- `src/fullstack.css`
- `tests/` for amount formatting and summary behavior

## Test expectations

- Cover multiple assets/statuses, filters, empty results, and decimal precision.
- Run `npm run check`.
