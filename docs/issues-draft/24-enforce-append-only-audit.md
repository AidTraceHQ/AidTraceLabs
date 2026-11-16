# Enforce Append-Only Audit Access

**Complexity:** high

## Context

Audit events are stored in an ordinary table; the schema does not prevent `UPDATE` or `DELETE` by the application database identity. Affected users: security auditors and compliance reviewers who need tamper-evidence guarantees for the audit trail. Current behavior: the runtime credential can update or delete any audit row; no database-level protection exists. Expected behavior: database ownership and grants allow the runtime to append and read audit events but not update or delete them. Migration and owner access remain separate. The policy must be tested against the actual runtime role. Evidence: `migrations/001_initial_schema.sql` (audit_events table definition) and `server/records.ts` (the `writeAudit` helper, function `writeAudit`).

## Acceptance criteria

- An integration test authenticated as the runtime role asserts it can insert and read audit rows but that `UPDATE`/`DELETE` on the audit table fail with a privilege error.
- Re-running `npm run db:migrate` on a fresh database applies the grants idempotently and the integration test passes.
- The documented emergency maintenance path names the higher-privilege role required.
- `npm test -- tests/backend.test.ts` passes against the dedicated test database.

## Files to touch

- `migrations/` (new grants/ownership migration)
- `server/records.ts` (only if the write path needs an explicit audit-writer role)
- `tests/backend.test.ts`
- `docs/security.md`
- `docs/deployment.md`

## Test expectations

- Run: `npm test -- tests/backend.test.ts` against the dedicated test database.
- Run: `npm run db:migrate` against an isolated test branch only.
- Run: `npm run typecheck`

## Out of scope

Replacing audit storage or claiming protection from a database superuser.

## Depends on

Separate Runtime and Migration Database Roles
