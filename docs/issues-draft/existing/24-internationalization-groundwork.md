# Internationalization Groundwork

**Complexity:** medium

## Context

User-visible strings are authored inline throughout `src/App.tsx`, and no i18n library is
declared in `package.json`. Dates are produced with `toLocaleString()` directly at
`src/App.tsx:1422`, `src/App.tsx:1616`, `src/App.tsx:1670` and `src/App.tsx:1995` using
the environment's default locale, while canonical amounts are formatted by `formatAmount`
(`src/App.tsx:112`) with BigInt string math so values never go through floating point.

This issue only prepares localization foundations. It does not claim translation coverage:
the goal is message keys, a fallback locale, and locale-aware date/number formatting for a
representative flow so later translation work has somewhere to land.

## Acceptance criteria

- A short inventory of user-visible strings for one representative flow is produced, and a
  lightweight, maintained message/formatting approach is chosen (a dependency is added only
  if `package.json` records the justification).
- A default/fallback locale is defined and used when a requested locale has no message.
- One representative flow reads its labels from message keys instead of inline literals.
- Dates are formatted through a locale-aware formatter and numbers through `Intl.NumberFormat`.
- Canonical API values are unchanged: amount strings passed to the API, comparisons and the
  CSV export are identical to today; localization affects display only.
- Addresses and status identifiers (for example `verified`, `mismatch`, `voided`) are never
  auto-translated.
- `npm run check` passes.

## Files to touch

- `src/App.tsx`
- `src/` localization module and message/resource files
- `tests/` (formatting and fallback behaviour)
- `package.json` only if a dependency is justified

## Test expectations

- Cover fallback messages when a key/locale is missing, locale-aware date and number
  formatting, and that canonical API values are byte-identical before and after.
- Confirm `formatAmount` output used for comparisons/export is unaffected by the display
  formatting.
- Run: `npm run check`.

## Out of scope

Full translation of every screen, a locale switcher, right-to-left layout work, and
translating addresses, transaction hashes or status codes.

## Depends on

None
