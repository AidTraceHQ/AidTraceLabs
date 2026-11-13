# Test Audit Events for Every Successful Mutation

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 18 hours

**Release day:** Day 1

## Problem statement

Every successful mutation writes an audit row: `record_created` (`server/records.ts:830-836`), `record_updated` (`server/records.ts:983-989`), `record_voided` (`server/records.ts:1063-1069`), `wallet_role_changed` (`server/records.ts:1163-1170`), `wallet_role_removed` (`server/records.ts:1210-1217`), `wallet_authenticated` (`server/auth.ts:307-311`), `wallet_logged_out` (`server/auth.ts:369-373`), and `wallet_logout_everywhere` (`server/auth.ts:397-401`). Only `record_voided` is asserted (`tests/backend.test.ts:859-868`); no test references the other action names (confirmed: no matches in `tests/`). Affected: audit-trail integrity for every recorded action.

## Technical implementation requirements

- Add integration tests that perform each mutation and query `audit_events` (or `/api/audit`) for the expected `action`, `actor_wallet`, and, where set, `subject_wallet`/`record_id`.
- Assert that login, logout, and logout-everywhere write their actions during the existing flows.
- Treat a missing expected row as a failure.
- Do NOT change audit content or the write path, add rejection auditing, or enforce database-level append-only access.

## Files and areas to touch

- `tests/backend.test.ts`
- `docs/security.md` (optional coverage note)

## Dependencies

- Requires a test database. Distinct from rejection auditing and from append-only enforcement.

## Measurable acceptance criteria

- Each listed action is observed with correct actor/subject/record attribution.
- Removing a write would fail the corresponding test.
- `npm test -- tests/backend.test.ts` passes; `npm run typecheck` passes.

## Expected deliverables

- Audit-coverage tests for all existing mutation writes.

## How to set up and run tests

- Configure `TEST_DATABASE_URL`/`TEST_DATABASE_BRANCH=test`, then `npm test -- tests/backend.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- New audit events for rejections, database-level tamper protection, or audit-viewer filters.

## Suggested labels

- `area: security`, `area: testing`, `type: enhancement`, `difficulty: high`.
