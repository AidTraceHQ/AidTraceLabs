# Prevent Older Toast Timers Clearing Newer Messages

**Complexity:** beginner

## Context

Each notification starts an independent `setTimeout`. When a second toast is shown before the first timer fires, the first timer can clear the newer message before the user has seen it for its full intended duration. Additionally, a pending timer may attempt a state update after the component has unmounted. Affected users: any user who receives two rapid notifications. Current behavior: each toast starts its own independent timeout; whichever fires first clears the displayed message. Expected behavior: showing a new toast cancels the previous timer; the active timer is cleared on component teardown. Evidence: `src/App.tsx` (toast state and timeout logic).

## Acceptance criteria

- `npx vitest run tests/toast.test.ts` uses fake timers to show two toasts in sequence and asserts the second message is still visible after advancing to `duration - 1` ms and is cleared exactly at `duration` ms.
- A test unmounts the component while a timer is pending and asserts no state update occurs after unmount.

## Files to touch

- `src/App.tsx`
- `src/toast.ts` (if extracting testable timer behavior)
- `tests/toast.test.ts`

## Test expectations

- Run: `npx vitest run tests/toast.test.ts`
- Run: `npm run typecheck`
- No database setup required.

## Out of scope

Replacing the notification component or changing message content.

## Depends on

None
