# Reconcile the Active Wallet Role

**Publish:** Day 1

**Size:** Medium

## Problem statement

The client restores its role at startup, while the API resolves role assignments dynamically. A role changed by another admin can leave the open UI showing controls for the previous role until reload.

## Technical requirements

- Reconcile the current session from `/api/me` at a bounded lifecycle point, such as tab focus, and after authorization failures.
- Preserve server authorization as the authority; do not make client state an access-control check.

## Files to touch

- `src/App.tsx`
- `src/api.ts`
- `tests/api.test.ts` or a focused session-state test

## Dependencies on other issues

- None.

## Acceptance criteria

- A changed role is reflected without requiring a full page reload after the chosen refresh event.
- Stale client controls never grant server access; 401/403 responses still fail closed.
- Refresh requests do not create an unbounded polling loop.

## Deliverables

- Client role reconciliation and focused state/API tests; no authentication protocol changes.

## How to run tests

- `npx vitest run tests/api.test.ts`
- `npm run typecheck`

## Out of scope

- Changing wallet login, signatures, sessions, role policy, or administrator assignment rules.

## Suggested labels

- `area: frontend`, `type: bug`, `difficulty: medium`.
