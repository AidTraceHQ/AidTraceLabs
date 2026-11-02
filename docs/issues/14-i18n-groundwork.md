# Internationalization Groundwork

**Complexity:** medium

## Context

UI labels and date/amount formatting are currently authored directly in the application. Prepare localization foundations without claiming translation coverage.

## Acceptance criteria

- Inventory user-visible strings and choose a lightweight, maintained message/formatting approach.
- Move one representative flow to message keys and locale-aware date/number formatting.
- Preserve exact canonical amounts for transaction comparisons; localization must affect display only.
- Define a fallback locale and avoid automatic translation of addresses/status identifiers.

## Files to touch

- `src/App.tsx`
- `src/` localization module/resource files
- `tests/` formatting and fallback tests
- `package.json` only if a dependency is justified

## Test expectations

- Cover fallback messages, locale-formatted dates/numbers, and unchanged canonical API values.
- Run `npm run check`.
