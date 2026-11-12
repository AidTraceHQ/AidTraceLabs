# Make Role Changes Traceable in the Audit View

**Publish:** Day 1

**Size:** Medium

## Problem statement

Role-change writes store a subject wallet, but the audit API omits that field and the admin UI shows only the actor. The form also accepts no reason for the change.

## Technical requirements

- Include the subject wallet in audit API results and display it distinctly from the actor.
- Collect a bounded, non-secret reason for role assignment/removal and include it in the audit event.
- Keep the existing audit filtering issue #15 separate; this adds event context, not filters.

## Files to touch

- `server/records.ts`
- `src/App.tsx`
- `tests/backend.test.ts`

## Dependencies on other issues

- None.

## Acceptance criteria

- Each role-change audit row identifies actor, target wallet suffix, old/new role, reason, and time.
- Reason length and empty-value behavior are validated consistently.
- Existing role authorization and self-protection remain unchanged.

## Deliverables

- API/UI update and tests for role-change audit data and validation.

## How to run tests

- `npm test -- tests/backend.test.ts`
- `npm run typecheck`

## Out of scope

- Audit filters, a new audit provider, or changes to role policy.

## Suggested labels

- `area: backend`, `area: frontend`, `type: enhancement`, `difficulty: medium`.
