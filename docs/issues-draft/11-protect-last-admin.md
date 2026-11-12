# Prevent Removing the Last Active Administrator

**Publish:** Day 1

**Size:** High

## Problem statement

The API prevents an administrator from removing or demoting themself, but another administrator can remove the final active admin role and leave the system without UI administration.

## Technical requirements

- Make the final-admin check transactional and safe under concurrent role changes.
- Apply the rule to both role demotion and role removal.
- Return a stable conflict response and audit the rejected attempt without weakening existing checks.

## Files to touch

- `server/records.ts`
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Dependencies on other issues

- None.

## Acceptance criteria

- The last active admin cannot be demoted or removed by another admin.
- An admin can be removed/demoted when at least one other active admin remains.
- Concurrent requests cannot both remove the final admins.

## Deliverables

- Transaction-safe authorization guard, regression tests, and documented policy.

## How to run tests

- `npm test -- tests/backend.test.ts`
- `npm run typecheck`

## Out of scope

- Rewriting wallet login, changing admin bootstrap, or adding an account-recovery backdoor.

## Suggested labels

- `area: security`, `area: backend`, `type: bug`, `difficulty: high`.
