# Clean Up Expired Authentication and Rate-Limit Rows

**Publish:** Day 1

**Size:** Medium

## Problem statement

Sessions, challenges, and rate-limit counters have expiry timestamps, but no bounded cleanup task removes expired rows.

## Technical requirements

- Add an operator-invoked or scheduled cleanup that deletes only expired/revoked ephemeral rows in bounded batches.
- Document retention for audit events and aid records separately; do not apply this cleanup to them.

## Files to touch

- `scripts/` (new cleanup command)
- `package.json`
- `migrations/001_initial_schema.sql` only if query-supporting indexes are missing
- `tests/` (focused cleanup tests)
- `docs/deployment.md`

## Dependencies on other issues

- Runtime least-privilege permissions from #13 may constrain the cleanup identity.

## Acceptance criteria

- Expired sessions/challenges/rate limits are removed; unexpired and audit/business rows are retained.
- The command is repeatable, batch-bounded, and reports counts only.
- Tests cover boundary timestamps and repeat execution.

## Deliverables

- Cleanup command, focused tests, and scheduling/retention documentation.

## How to run tests

- `npm test -- tests/backend.test.ts`
- `npm run typecheck`

## Out of scope

- Deleting aid records, verification history, audit history, or user identities.

## Suggested labels

- `area: backend`, `area: infrastructure`, `type: enhancement`, `difficulty: medium`.
