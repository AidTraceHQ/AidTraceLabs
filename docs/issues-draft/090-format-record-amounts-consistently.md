# Format record amounts consistently

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 2 hours

**Release day:** Day 5

## Problem statement

The transparency summary cards render grouped amounts through `formatAmount` (`src/App.tsx:112-115`,
used at `src/App.tsx:865` and `src/App.tsx:1129`), but the record table, beneficiary table, record
detail view and activity table render the raw string value (`src/App.tsx:1263`, `src/App.tsx:1505`,
`src/App.tsx:1951`, `src/App.tsx:1419`). The same value can therefore read `1,000.5 USDC` in the
summary and `1000.5 USDC` in its own row, which looks like two different figures to a reviewer who
is comparing the headline total with the underlying records.

## Technical implementation requirements

- Extract one amount formatter that preserves the existing grouping behaviour of `formatAmount`.
- Use that formatter everywhere a record or activity amount is displayed, including the summary
  "Disbursed by asset" line and the "Other statuses (excluded)" line.
- Keep the asset code suffix and the `—` fallback rendering unchanged.
- Do not change stored values, server projections, numeric sorting, or numeric inputs.

## Files and areas to touch

- `src/App.tsx`
- `src/amount.ts` (if the formatter is extracted)
- `tests/amount.test.ts`
- `docs/manual-test-checklist.md`

## Dependencies

- None.

## Measurable acceptance criteria

- For the same value, the summary and every table/detail occurrence render identical grouping
  (for example `1000.5` renders as `1,000.5`).
- Integer, fractional, very large, and empty values render a stable result without throwing.
- A focused unit test covers large, fractional, and empty inputs.
- `npm test -- tests/amount.test.ts` passes and `npm run typecheck` succeeds.

## Expected deliverables

- A shared amount formatter, updated call sites, and unit tests.

## How to set up and run tests

- Run `npm run dev` and compare a record row with the summary total in the browser.
- Run `npm test -- tests/amount.test.ts` and `npm run typecheck`.

## Out of scope

- Locale-aware `Intl` formatting, currency symbols, or any change to how amounts are stored or
  validated on the server.

## Suggested labels

- `area: frontend`, `type: bug`, `difficulty: trivial`
