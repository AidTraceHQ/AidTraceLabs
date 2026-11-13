# Make Role Changes Traceable in the Audit View

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 1

## Problem statement

Role-change writes store a subject wallet, but the audit API omits that field and the admin UI shows only the actor. The form also accepts no reason for the change.

## Technical implementation requirements

- Include the subject wallet in audit API results and display it distinctly from the actor.
- Collect a bounded, non-secret reason for role assignment/removal and include it in the audit event.
- Keep the existing GitHub issue #15 for audit filtering separate; this adds event context, not filters.

## Files and areas to touch

- `server/records.ts`
- `src/App.tsx`
- `tests/backend.test.ts`

## Dependencies

- None.

## Measurable acceptance criteria

- A test asserts each role-change audit row exposes the actor wallet suffix, the subject/target wallet suffix, the old role, the new role, the reason, and a timestamp.
- A test asserts an over-length reason is rejected with a 4xx status and that an empty reason follows the documented behavior.
- Existing role-authorization and self-protection tests still pass (an admin cannot change their own role).
- `npm test -- tests/backend.test.ts` passes.

## Expected deliverables

- API/UI update and tests for role-change audit data and validation.

## How to set up and run tests

- `npm test -- tests/backend.test.ts`
- `npm run typecheck`

## Out of scope

- Audit filters, a new audit provider, or changes to role policy.

## Suggested labels

- `area: backend`, `area: frontend`, `type: enhancement`, `difficulty: medium`.
