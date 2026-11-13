# Add a retry action to the ledger load error

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 3 hours

**Release day:** Day 4

## Problem statement

When the ledger fails to load, `loadTransparency` stores a message in the shared `error` state
(`src/App.tsx:282-283`, the `catch` that calls `setError(messageOf(e))`) and the global alert
(`div.alert.error` with `role="alert"`, `src/App.tsx:1026-1032`) renders it with only a Dismiss button. To
retry the user must find the separate Refresh button in the section header (`src/App.tsx:1086-1091`), and the
alert does not say which operation failed. Affected: public visitors and reviewers whose first ledger request
times out or returns 5xx.

## Technical implementation requirements

- Give the ledger load error an actionable Retry that re-runs `loadTransparency`.
- Keep the global alert for unrelated errors; do not turn every error into a retry.
- Do not add automatic retry loops or change request timing.

## Files and areas to touch

- `src/App.tsx`

## Dependencies

- None.

## Measurable acceptance criteria

- When `loadTransparency` fails, the ledger error state renders a Retry control whose handler calls
  `loadTransparency`; activating it issues a new `GET /api/transparency` request (observable in the network
  panel) without a page reload.
- Dismissing the global alert (`src/App.tsx:1030-1032`) clears `error` and issues no network request.
- `npm run typecheck` and `npm test` exit 0.

## Expected deliverables

- A retry affordance on the ledger error state.

## How to set up and run tests

- Run `npm run dev`, stop the API (or point `VITE_API_BASE_URL` at a dead port), load the ledger,
  restore the API, and use Retry.

## Out of scope

- Automatic retry/backoff, error analytics, and the activity-table error state.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: trivial`
