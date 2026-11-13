# Enforce Append-Only Audit Access

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 10 hours

**Release day:** Day 3

## Problem statement

Audit events are stored in an ordinary table; the schema does not prevent update/delete operations by the application database identity.

## Technical implementation requirements

- Define database ownership and grants so runtime code can append and read events but cannot update/delete them.
- Keep migration/owner access separate and document emergency maintenance behavior.
- Test the policy against the actual runtime role rather than relying only on application route tests.

## Files and areas to touch

- `migrations/` (new grants/ownership migration)
- `server/records.ts` only if the write path needs an explicit audit-writer role
- `tests/backend.test.ts`
- `docs/security.md`
- `docs/deployment.md`

## Dependencies

- "Separate Runtime and Migration Database Roles" runtime/migration database role separation.

## Measurable acceptance criteria

- An integration test authenticated as the runtime role asserts it can insert and read audit rows but that `UPDATE`/`DELETE` on the audit table fail with a privilege error.
- Re-running `npm run db:migrate` on a fresh database applies the grants idempotently and the integration test passes.
- The documented emergency maintenance path names the higher-privilege role required.
- `npm test -- tests/backend.test.ts` passes against the dedicated test database.

## Expected deliverables

- Database privilege migration, role-based integration test, and operational documentation.

## How to set up and run tests

- `npm test -- tests/backend.test.ts` against the dedicated test database
- `npm run db:migrate` against an isolated test branch only
- `npm run typecheck`

## Out of scope

- Replacing audit storage or claiming protection from a database superuser.

## Suggested labels

- `area: security`, `area: backend`, `type: enhancement`, `difficulty: high`.
