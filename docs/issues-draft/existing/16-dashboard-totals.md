# Dashboard Totals

**Complexity:** medium

## Context

The server side already exists. `transparencyHandler` (`server/records.ts:692`) runs
`SELECT r.status, r.asset_code, SUM(r.amount_stroops)::text ... GROUP BY r.status,
r.asset_code` (`server/records.ts:704`) and returns it as `summary.byStatus`
(`server/records.ts:737`), typed at `src/api.ts:20`. The UI consumes it through
`ledgerTotals` (`src/App.tsx:200`), split into `verifiedTotals` and `otherStatusTotals`
(`src/App.tsx:862`) and rendered as a "Disbursed by asset (verified only)" tile in the
`.summary-grid` (`src/App.tsx:1125`).

Confirmed on `main`, the remaining gap is presentation only: the tile shows only verified
totals as amounts and collapses every other status into a single text line ("Other
statuses (excluded): …"), and the label "Disbursed by asset" reads as recipient use or
impact rather than an entered record total. Because the bulk of this issue has already
shipped, the maintainer may prefer to **close it**; otherwise the checkable delta below is
what remains.

## Acceptance criteria

- The dashboard renders the API's `summary.byStatus` rows grouped by verification status,
  each group showing its per-asset totals, driven by the active filters (no client-side
  re-aggregation of `aid_records`).
- The label states these are entered record totals and must not be read as recipient use or
  impact (for example "Record totals by status (not proof of recipient use)").
- Consent behaviour is unchanged: no private field is introduced by the totals view.
- An empty result set renders a neutral state (for example an em dash or "No records") with
  no `NaN` or `undefined` text.
- Amounts stay string-based through `formatAmount` (`src/App.tsx:112`); no floating-point
  arithmetic is introduced.
- `npm run check` passes.

## Files to touch

- `src/App.tsx`
- `src/fullstack.css`
- `tests/` (amount formatting and summary rendering)

## Test expectations

- Cover multiple assets and statuses, active filters, empty results, and decimal precision
  without float corruption.
- Manual: for a filtered ledger view, compare the rendered tiles against the
  `GET /api/transparency` `summary.byStatus` array.
- Run: `npm run check`.

## Out of scope

Changing the aggregation SQL, the verified-payment amounts, or the CSV export. No new API
parameters.

## Depends on

None
