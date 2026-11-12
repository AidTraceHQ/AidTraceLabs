# Prevent Older Toast Timers Clearing Newer Messages

**Publish:** Day 1

**Size:** Trivial

## Problem statement

Each notification starts an independent timeout. A previous timeout can clear a newer toast before the newer message has been visible for its intended duration.

## Technical requirements

- Cancel or replace the previous timeout when a new toast is shown.
- Clear the timer on component teardown.

## Files to touch

- `src/App.tsx`
- `src/toast.ts` (if extracting testable timer behavior)
- `tests/toast.test.ts`

## Dependencies on other issues

- None.

## Acceptance criteria

- A second notification remains visible for its full configured duration.
- No timer updates state after the component is unmounted.

## Deliverables

- Timer lifecycle fix and fake-timer tests.

## How to run tests

- `npx vitest run tests/toast.test.ts`
- `npm run typecheck`

## Out of scope

- Replacing the notification component or changing message content.

## Suggested labels

- `area: frontend`, `type: bug`, `difficulty: trivial`.
