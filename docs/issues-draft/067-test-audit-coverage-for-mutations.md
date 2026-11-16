# Test Audit Events for Every Successful Mutation

**Complexity:** high

## Context

Every successful mutation writes an audit row: `record_created` at `server/records.ts` (lines 830–836), `record_updated` (lines 983–989), `record_voided` (lines 1063–1069), `wallet_role_changed` (lines 1163–1170), `wallet_role_removed` (lines 1210–1217), `wallet_authenticated` at `server/auth.ts` (lines 307–311), `wallet_logged_out` (lines 369–373), and `wallet_logout_everywhere` (lines 397–401). Only `record_voided` is asserted in `tests/backend.test.ts` (lines 859–868); no test references the other action names (confirmed: no matches in `tests/`). Affected: audit-trail integrity for every recorded action. Current behavior: seven of eight audit actions are unasserted and could regress silently.

## Acceptance criteria

- Integration tests perform each mutation and query `audit_events` (or `/api/audit`) for the expected `action`, `actor_wallet`, and, where set, `subject_wallet`/`record_id`.
- Login, logout, and logout-everywhere write their actions during the existing flows.
- Removing a write would fail the corresponding test.
- `npm test -- tests/backend.test.ts` passes; `npm run typecheck` passes.

## Files to touch

- `tests/backend.test.ts`
- `docs/security.md` (optional coverage note)

## Test expectations

- Configure: `TEST_DATABASE_URL`/`TEST_DATABASE_BRANCH=test`
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

New audit events for rejections, database-level tamper protection, or audit-viewer filters.

## Depends on

None
