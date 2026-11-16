# Add a Retry Action to the Ledger Load Error

**Complexity:** trivial

## Context

When the ledger fails to load, `loadTransparency` stores a message in the shared `error` state in `src/App.tsx` (the `catch` at lines 282–283), and the global `div.alert.error` alert (lines 1026–1032) renders it with only a Dismiss button. To retry, the user must find the separate Refresh button in the section header (lines 1086–1091), and the alert does not name which operation failed. Affected: public visitors and reviewers whose first ledger request times out or returns 5xx. Current behavior: ledger load failure shows a generic dismissible alert with no retry. Expected behavior: a Retry action is attached to the ledger load error that re-runs `loadTransparency`.

## Acceptance criteria

- When `loadTransparency` fails, the ledger error state renders a Retry control whose handler calls `loadTransparency`; activating it issues a new `GET /api/transparency` request without a page reload.
- Dismissing the global alert clears `error` and issues no network request.
- `npm run typecheck` and `npm test` exit 0.

## Files to touch

- `src/App.tsx`

## Test expectations

- Manual: run `npm run dev`, stop the API (or point `VITE_API_BASE_URL` at a dead port), load the ledger, restore the API, and use Retry.
- Run: `npm run typecheck`
- Run: `npm test`

## Out of scope

Automatic retry/backoff, error analytics, and the activity-table error state.

## Depends on

None
