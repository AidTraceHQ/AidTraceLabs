# Prevent Removing the Last Active Administrator

**Complexity:** intermediate

## Context

The API prevents an administrator from removing or demoting themselves, but another administrator can remove the final active admin role and leave the system without any administrator. Affected users: all users of a deployment that has accidentally lost its last admin. Current behavior: a second admin can remove the last remaining active admin, leaving the system in a deadlocked state. Expected behavior: any attempt to demote or remove the last active admin is rejected with a stable conflict response (`409`) regardless of which admin makes the attempt. The check must be transactional to be safe under concurrent role changes. Evidence: `server/records.ts` (role mutation handlers and self-protection guard).

## Acceptance criteria

- A test demoting or removing the last remaining active admin as a different admin receives `409` and leaves the role unchanged.
- A test asserts the operation returns `200` when at least one other active admin remains.
- A concurrency test issues two simultaneous removals against a set of two admins and asserts at most one succeeds, so at least one admin always remains.
- `npm test -- tests/backend.test.ts` passes.

## Files to touch

- `server/records.ts`
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Test expectations

- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`
- Requires `TEST_DATABASE_URL` and `TEST_DATABASE_BRANCH=test`.

## Out of scope

Rewriting wallet login, changing admin bootstrap, or adding an account-recovery backdoor.

## Depends on

None
