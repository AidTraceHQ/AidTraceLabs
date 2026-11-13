# Clean Up Expired Authentication and Rate-Limit Rows

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 1

## Problem statement

Sessions, challenges, and rate-limit counters have expiry timestamps, but no bounded cleanup task removes expired rows.

## Technical implementation requirements

- Add an operator-invoked or scheduled cleanup that deletes only expired/revoked ephemeral rows in bounded batches.
- Document retention for audit events and aid records separately; do not apply this cleanup to them.

## Files and areas to touch

- `scripts/` (new cleanup command)
- `package.json`
- `migrations/001_initial_schema.sql` only if query-supporting indexes are missing
- `tests/` (focused cleanup tests)
- `docs/deployment.md`

## Dependencies

- Runtime least-privilege permissions from "Separate Runtime and Migration Database Roles" may constrain the cleanup identity.

## Measurable acceptance criteria

- Running the cleanup against a fixture with expired and unexpired sessions/challenges/rate-limits deletes only the expired rows (asserted by row counts) and leaves unexpired rows, audit events, and aid records intact.
- Running the command twice produces no further deletions after the first run (idempotent).
- A test asserts rows exactly at the expiry boundary follow the documented behavior.
- Each run prints counts only and never row contents.
- `npm test -- tests/backend.test.ts` passes.

## Expected deliverables

- Cleanup command, focused tests, and scheduling/retention documentation.

## How to set up and run tests

- `npm test -- tests/backend.test.ts`
- `npm run typecheck`

## Out of scope

- Deleting aid records, verification history, audit history, or user identities.

## Suggested labels

- `area: backend`, `area: infrastructure`, `type: enhancement`, `difficulty: medium`.
