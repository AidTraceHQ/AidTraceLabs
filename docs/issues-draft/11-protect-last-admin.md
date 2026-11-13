# Prevent Removing the Last Active Administrator

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 7 hours

**Release day:** Day 1

## Problem statement

The API prevents an administrator from removing or demoting themself, but another administrator can remove the final active admin role and leave the system without UI administration.

## Technical implementation requirements

- Make the final-admin check transactional and safe under concurrent role changes.
- Apply the rule to both role demotion and role removal.
- Return a stable conflict response and audit the rejected attempt without weakening existing checks.

## Files and areas to touch

- `server/records.ts`
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Dependencies

- None.

## Measurable acceptance criteria

- A test demoting or removing the last remaining active admin as a different admin receives a stable conflict status (e.g. `409`) and leaves the role unchanged.
- A test asserts the operation succeeds (e.g. `200`) when at least one other active admin remains.
- A concurrency test issues two simultaneous removals against a set of two admins and asserts at most one succeeds, so at least one admin always remains.
- `npm test -- tests/backend.test.ts` passes.

## Expected deliverables

- Transaction-safe authorization guard, regression tests, and documented policy.

## How to set up and run tests

- `npm test -- tests/backend.test.ts`
- `npm run typecheck`

## Out of scope

- Rewriting wallet login, changing admin bootstrap, or adding an account-recovery backdoor.

## Suggested labels

- `area: security`, `area: backend`, `type: bug`, `difficulty: medium`.
