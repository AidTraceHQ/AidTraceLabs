# Bound the Account Activity Request Lifecycle

**Complexity:** intermediate

## Context

Activity loading starts three unbounded fetches (account, payments, transactions). A request from a previous wallet or network can finish after a switch or logout and overwrite the newer screen state. Polling can also overlap slow in-flight requests, creating an unbounded backlog. Affected users: connected wallet holders who switch networks or log out while activity is loading. Current behavior: no timeout, no cancellation token, and no generation check on activity fetch results. Expected behavior: results are associated with the wallet/network request generation, stale completions are ignored, and concurrent refreshes are bounded. Evidence: `src/App.tsx` (activity fetch logic, approximately lines 392Ã¢â‚¬â€œ493).

## Acceptance criteria

- A test logs out or switches wallet/network while activity fetches are in flight and asserts stale results do not repopulate the screen.
- A test forces a request timeout and asserts loading state settles and a recoverable error is shown.
- A test emits rapid stream events and asserts the count of concurrent activity requests stays under a fixed bound (no unbounded backlog).
- `npx vitest run tests/activity.test.ts` passes.

## Files to touch

- `src/App.tsx`
- `src/activity.ts` (if extracting request orchestration)
- `tests/activity.test.ts`

## Test expectations

- Run: `npx vitest run tests/activity.test.ts`
- Run: `npm run typecheck`
- No database required; uses mocked Horizon responses.

## Out of scope

Historical activity pagination, redesigning the activity screen, or changing Stellar verification.

## Depends on

Use Configured Horizon Endpoints in Browser Activity
