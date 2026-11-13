# Bound the Account Activity Request Lifecycle

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 3

## Problem statement

Activity loading starts three unbounded fetches. A request from a previous wallet/network can finish after a switch or logout and overwrite the newer screen state; polling can also overlap slow requests.

## Technical implementation requirements

- Add request timeouts and cancellation for the account/payment/transaction fetch group.
- Associate results with the wallet/network request generation and ignore stale completions.
- Prevent unbounded overlapping poll/SSE-triggered refreshes and clear loading state safely.

## Files and areas to touch

- `src/App.tsx`
- `src/activity.ts` (if extracting request orchestration)
- `tests/activity.test.ts`

## Dependencies

- "Use Configured Horizon Endpoints in Browser Activity" if the configured browser Horizon URL is introduced first; otherwise retain current defaults.

## Measurable acceptance criteria

- A test logs out or switches wallet/network while activity fetches are in flight and asserts stale results do not repopulate the screen.
- A test forces a request timeout and asserts loading state settles and a recoverable error is shown.
- A test emits rapid stream events and asserts the count of concurrent activity requests stays under a fixed bound (no unbounded backlog).
- `npx vitest run tests/activity.test.ts` passes.

## Expected deliverables

- Request lifecycle helper/component changes and focused cancellation/race tests.

## How to set up and run tests

- `npx vitest run tests/activity.test.ts`
- `npm run typecheck`

## Out of scope

- Historical activity pagination, redesigning the activity screen, or changing Stellar verification.

## Suggested labels

- `area: frontend`, `type: bug`, `difficulty: medium`.
