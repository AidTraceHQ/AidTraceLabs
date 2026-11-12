# Bound the Account Activity Request Lifecycle

**Publish:** Day 3

**Size:** Medium

## Problem statement

Activity loading starts three unbounded fetches. A request from a previous wallet/network can finish after a switch or logout and overwrite the newer screen state; polling can also overlap slow requests.

## Technical requirements

- Add request timeouts and cancellation for the account/payment/transaction fetch group.
- Associate results with the wallet/network request generation and ignore stale completions.
- Prevent unbounded overlapping poll/SSE-triggered refreshes and clear loading state safely.

## Files to touch

- `src/App.tsx`
- `src/activity.ts` (if extracting request orchestration)
- `tests/activity.test.ts`

## Dependencies on other issues

- #18 if the configured browser Horizon URL is introduced first; otherwise retain current defaults.

## Acceptance criteria

- Logging out or switching wallet/network cannot repopulate activity with stale results.
- Timed-out requests settle loading state and show a recoverable error.
- Repeated stream events do not create an unbounded request backlog.

## Deliverables

- Request lifecycle helper/component changes and focused cancellation/race tests.

## How to run tests

- `npx vitest run tests/activity.test.ts`
- `npm run typecheck`

## Out of scope

- Historical activity pagination, redesigning the activity screen, or changing Stellar verification.

## Suggested labels

- `area: frontend`, `type: bug`, `difficulty: medium`.
