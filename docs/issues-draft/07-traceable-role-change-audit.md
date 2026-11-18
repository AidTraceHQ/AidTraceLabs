# Make Role Changes Traceable in the Audit View

**Complexity:** intermediate

## Context

Role-change writes store the subject wallet address in the database, but the audit API omits that field and the admin UI shows only the actor wallet. The form also accepts no reason for the change. Affected users: administrators reviewing role-change history who cannot see who was changed or why. Current behavior: audit rows for role changes include only the actor; no reason is collected or stored. Expected behavior: each role-change audit row exposes the actor wallet suffix, the subject wallet suffix, the old role, the new role, the reason, and a timestamp. Evidence: `server/records.ts` (role mutation handlers and `writeAudit` calls) and `src/App.tsx` (admin audit display).

## Acceptance criteria

- A test asserts each role-change audit row exposes the actor wallet suffix, the subject wallet suffix, the old role, the new role, the reason, and a timestamp.
- A test asserts an over-length reason is rejected with a 4xx status and that an empty reason follows the documented behavior.
- Existing role-authorization and self-protection tests still pass (an admin cannot change their own role).
- `npm test -- tests/backend.test.ts` passes.

## Files to touch

- `server/records.ts`
- `src/App.tsx`
- `tests/backend.test.ts`

## Test expectations

- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`
- Requires `TEST_DATABASE_URL` and `TEST_DATABASE_BRANCH=test`.

## Out of scope

Audit filters, a new audit provider, or changes to role policy. This draft adds event context, not filters; filters are tracked by a separate open issue.

## Depends on

None
