# Add an index for the admin roles list ordering

**Complexity:** beginner

## Context

`GET /api/admin/roles` sorts by `updated_at` then wallet address. The `listRows` call in that handler passes `'wr.updated_at'` and `'wr.wallet_address'` as the time and id columns in `server/records.ts` (lines 1113Ã¢â‚¬â€œ1114), so the query issues `ORDER BY wr.updated_at DESC, wr.wallet_address DESC`. The only index on `wallet_roles` is `wallet_roles_role_wallet_idx(role, wallet_address)` in `migrations/001_initial_schema.sql` (line 13), which does not match that ordering. As role rows accumulate, PostgreSQL must read the table and sort in memory for every admin role listing. Affected: administrators loading the role list.

## Acceptance criteria

- After `npm run db:migrate`, a query `SELECT indexdef FROM pg_indexes WHERE tablename = 'wallet_roles'` returns an index whose `indexdef` contains `btree (updated_at DESC, wallet_address DESC)` (asserted in `tests/backend.test.ts`).
- The existing role-list integration test still passes and returns the same `updated_at DESC, wallet_address DESC` order.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` exit 0.

## Files to touch

- `migrations/003_wallet_roles_updated_index.sql` (next free migration number; use the next free `NNN_name.sql` filename so the runner picks it up per the `/^\d{3}_[a-z0-9_]+\.sql$/` pattern)
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Test expectations

- Configure: `TEST_DATABASE_URL`/`TEST_DATABASE_URL_UNPOOLED`/`TEST_DATABASE_BRANCH=test` (see `CONTRIBUTING.md`)
- Run: `npm run db:migrate`
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Changing the pagination cursor format, the roles response shape, or the role filter index.

## Depends on

None
