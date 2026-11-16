# Format Record Amounts Consistently

**Complexity:** trivial

## Context

The transparency summary cards render grouped amounts through `formatAmount` in `src/App.tsx` (function `formatAmount`, lines 112–115, used at lines 865 and 1129), but the record table, beneficiary table, record detail view, and activity table render the raw string value (lines 1263, 1505, 1951, 1419). The same value can therefore read `1,000.5 USDC` in the summary and `1000.5 USDC` in its own row, which looks like two different figures to a reviewer comparing the headline total with the underlying records. Affected: anyone comparing summary totals with individual record rows.

## Acceptance criteria

- For the same value, the summary and every table/detail occurrence render identical grouping (e.g. `1000.5` renders as `1,000.5`).
- Integer, fractional, very large, and empty values render a stable result without throwing.
- A focused unit test covers large, fractional, and empty inputs.
- `npm test -- tests/amount.test.ts` passes and `npm run typecheck` succeeds.

## Files to touch

- `src/App.tsx`
- `src/amount.ts` (if the formatter is extracted)
- `tests/amount.test.ts`
- `docs/manual-test-checklist.md`

## Test expectations

- Run: `npm test -- tests/amount.test.ts`
- Run: `npm run typecheck`
- Manual: run `npm run dev` and compare a record row with the summary total in the browser.

## Out of scope

Locale-aware `Intl` formatting, currency symbols, or any change to how amounts are stored or validated on the server.

## Depends on

None
