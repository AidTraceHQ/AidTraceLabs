# Prevent Older Toast Timers Clearing Newer Messages

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 3 hours

**Release day:** Day 1

## Problem statement

Each notification starts an independent timeout. A previous timeout can clear a newer toast before the newer message has been visible for its intended duration.

## Technical implementation requirements

- Cancel or replace the previous timeout when a new toast is shown.
- Clear the timer on component teardown.

## Files and areas to touch

- `src/App.tsx`
- `src/toast.ts` (if extracting testable timer behavior)
- `tests/toast.test.ts`

## Dependencies

- None.

## Measurable acceptance criteria

- `npx vitest run tests/toast.test.ts` uses fake timers to show two toasts and asserts the second message is still visible after advancing to `duration - 1` ms and is cleared at `duration` ms.
- A test unmounts the component while a timer is pending and asserts no state update occurs after unmount.

## Expected deliverables

- Timer lifecycle fix and fake-timer tests.

## How to set up and run tests

- `npx vitest run tests/toast.test.ts`
- `npm run typecheck`

## Out of scope

- Replacing the notification component or changing message content.

## Suggested labels

- `area: frontend`, `type: bug`, `difficulty: trivial`.
