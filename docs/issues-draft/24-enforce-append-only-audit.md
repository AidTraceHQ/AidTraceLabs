# Enforce Append-Only Audit Access

**Publish:** Day 3

**Size:** High

## Problem statement

Audit events are stored in an ordinary table; the schema does not prevent update/delete operations by the application database identity.

## Technical requirements

- Define database ownership and grants so runtime code can append and read events but cannot update/delete them.
- Keep migration/owner access separate and document emergency maintenance behavior.
- Test the policy against the actual runtime role rather than relying only on application route tests.

## Files to touch

- `migrations/` (new grants/ownership migration)
- `server/records.ts` only if the write path needs an explicit audit-writer role
- `tests/backend.test.ts`
- `docs/security.md`
- `docs/deployment.md`

## Dependencies on other issues

- #13 runtime/migration database role separation.

## Acceptance criteria

- The runtime identity can insert/read audit rows but cannot update/delete them.
- Role grants are repeatable in a fresh migration run and covered by an integration test.
- Emergency migration access is explicitly documented.

## Deliverables

- Database privilege migration, role-based integration test, and operational documentation.

## How to run tests

- `npm test -- tests/backend.test.ts` against the dedicated test database
- `npm run db:migrate` against an isolated test branch only
- `npm run typecheck`

## Out of scope

- Replacing audit storage or claiming protection from a database superuser.

## Suggested labels

- `area: security`, `area: backend`, `type: enhancement`, `difficulty: high`.
