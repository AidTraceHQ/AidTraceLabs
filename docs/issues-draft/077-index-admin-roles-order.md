# Add an index for the admin roles list ordering

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 3 hours

**Release day:** Day 1

## Problem statement

`GET /api/admin/roles` sorts by `updated_at` then wallet address. The `listRows` call in that handler passes
`'wr.updated_at'` and `'wr.wallet_address'` as the time and id columns (`server/records.ts:1113-1114`),
so the query issues `ORDER BY wr.updated_at DESC, wr.wallet_address DESC`. The only index on
`wallet_roles` is `wallet_roles_role_wallet_idx(role, wallet_address)` (`migrations/001_initial_schema.sql:13`),
which does not match that ordering. As role rows accumulate, Postgres must read the table and sort in
memory for every admin role listing (and for every cursor page), instead of walking an index. Affected:
administrators loading the role list.

## Technical implementation requirements

- Add a forward-only migration that creates an index on `wallet_roles (updated_at DESC, wallet_address DESC)`.
- Keep the existing `wallet_roles_role_wallet_idx` (used by the `role` filter) and all route behaviour unchanged.
- Use the next free `NNN_name.sql` filename so the runner picks it up (the runner only applies files
  matching `/^\d{3}_[a-z0-9_]+\.sql$/` in the `readdir` filter of `migrate()`, `scripts/migrate.ts:74-76`).
- Do not change the roles API contract, filters, ordering, or cursor binding.

## Files and areas to touch

- `migrations/003_wallet_roles_updated_index.sql` (next free number)
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Dependencies

- None.

## Measurable acceptance criteria

- After `npm run db:migrate`, `SELECT indexdef FROM pg_indexes WHERE tablename = 'wallet_roles'` returns an
  index whose `indexdef` contains `btree (updated_at DESC, wallet_address DESC)` (asserted in
  `tests/backend.test.ts`).
- The existing role-list integration test still passes and returns the same `updated_at DESC, wallet_address
DESC` order.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` exit 0.

## Expected deliverables

- One index migration, a focused assertion that the index exists after migration, and a one-line update to
  the `wallet_roles` index list in `docs/backend-design.md`.

## How to set up and run tests

- Configure the disposable `TEST_DATABASE_URL`/`TEST_DATABASE_URL_UNPOOLED`/`TEST_DATABASE_BRANCH=test`
  described in `CONTRIBUTING.md`, then `npm run db:migrate` and `npm test -- tests/backend.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- Changing the pagination cursor format, the roles response shape, or the role filter index.

## Suggested labels

- `area: data`, `type: enhancement`, `difficulty: trivial`
