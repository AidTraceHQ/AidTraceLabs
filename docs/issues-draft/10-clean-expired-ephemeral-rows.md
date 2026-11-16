# Clean Up Expired Authentication and Rate-Limit Rows

**Complexity:** medium

## Context

Sessions, challenges, and rate-limit counters have expiry timestamps, but no bounded cleanup task removes expired rows. Affected users: operators of long-running deployments where the ephemeral tables grow without bound. Current behavior: expired/revoked rows accumulate indefinitely. Expected behavior: an operator-invoked or scheduled command deletes only expired/revoked ephemeral rows in bounded batches and prints row counts only. The cleanup must leave audit events, aid records, and unexpired rows untouched. Evidence: `migrations/001_initial_schema.sql` (sessions, challenges, rate_limits table definitions).

## Acceptance criteria

- Running the cleanup against a fixture with expired and unexpired sessions/challenges/rate-limits deletes only the expired rows (asserted by row counts) and leaves unexpired rows, audit events, and aid records intact.
- Running the command twice produces no further deletions after the first run (idempotent).
- A test asserts rows exactly at the expiry boundary follow the documented behavior.
- Each run prints counts only and never row contents.
- `npm test -- tests/backend.test.ts` passes.

## Files to touch

- `scripts/` (new cleanup command)
- `package.json`
- `migrations/001_initial_schema.sql` (only if query-supporting indexes are missing)
- `tests/` (focused cleanup tests)
- `docs/deployment.md`

## Test expectations

- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`
- Requires `TEST_DATABASE_URL` and `TEST_DATABASE_BRANCH=test`.

## Out of scope

Deleting aid records, verification history, audit history, or user identities.

## Depends on

Separate Runtime and Migration Database Roles
