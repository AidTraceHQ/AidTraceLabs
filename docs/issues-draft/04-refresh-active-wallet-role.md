# Reconcile the Active Wallet Role

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 1

## Problem statement

The client restores its role at startup, while the API resolves role assignments dynamically. A role changed by another admin can leave the open UI showing controls for the previous role until reload.

## Technical implementation requirements

- Reconcile the current session from `/api/me` at a bounded lifecycle point, such as tab focus, and after authorization failures.
- Preserve server authorization as the authority; do not make client state an access-control check.

## Files and areas to touch

- `src/App.tsx`
- `src/api.ts`
- `tests/api.test.ts` or a focused session-state test

## Dependencies

- None.

## Measurable acceptance criteria

- A test that changes the role returned by `/api/me` and fires the chosen refresh event (e.g. tab `focus`) asserts the UI reflects the new role from `/api/me` without a full page reload.
- A test asserts that a `401` or `403` from a protected route fails closed (the privileged control is not rendered or used) even when the client state still reports the previous role.
- A test fires the refresh event N times within a short window and asserts the number of `/api/me` calls stays within a fixed small bound, so there is no unbounded polling loop.

## Expected deliverables

- Client role reconciliation and focused state/API tests; no authentication protocol changes.

## How to set up and run tests

- `npx vitest run tests/api.test.ts`
- `npm run typecheck`

## Out of scope

- Changing wallet login, signatures, sessions, role policy, or administrator assignment rules.

## Suggested labels

- `area: frontend`, `type: bug`, `difficulty: medium`.
