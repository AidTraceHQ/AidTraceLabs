# CSV Export Tests

**Complexity:** medium

## Context

The ledger already exposes CSV export. Its escaping, filtering, and privacy behavior need regression coverage before further export changes.

## Acceptance criteria

- Extract only the minimum CSV utility needed for direct testing.
- Quote commas, quotes, and line breaks correctly and preserve Unicode text.
- Export only the currently filtered records and exclude hidden/private fields.
- Prevent spreadsheet formula interpretation for untrusted text cells.

## Files to touch

- `src/App.tsx`
- `src/api.ts` or a focused CSV utility under `src/`
- `tests/` (reuse the existing Vitest setup)

## Test expectations

- Cover escaping, formula-like values, empty exports, filtering, and withheld fields.
- Run `npm run check`.
