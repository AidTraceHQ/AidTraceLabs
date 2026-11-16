# Populate Structured Metadata on Audit Events

**Complexity:** medium

## Context

`audit_events` declares `metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb` in `migrations/001_initial_schema.sql` (line 112), but every audit write omits it. The `writeAudit` helper in `server/records.ts` (function `writeAudit`, lines 298–309) inserts only `(id, action, actor_wallet, subject_wallet, record_id, summary)`. The auth-side writes in `server/auth.ts` insert only `(id, action, actor_wallet, summary)` (the `audit()` helper at lines 166–172 and the inline INSERT at lines 307–311). `metadata_json` is therefore always `'{}'`. Concrete losses include the previous role on a role change (the `writeAudit` call at lines 1163–1170 interpolates the old role into a summary string only) and the verification status/ledger on verification events. Affected: admins reviewing audit history who need structured, queryable detail.

## Acceptance criteria

- After a role change and a record void, a direct query or `/api/audit` asserts the `wallet_role_changed` row's `metadata_json` contains the previous and new role, the `record_voided` row carries the void reason, and no stored value equals the actor's session or CSRF token.
- Existing audit-related integration tests still pass, and the stored `summary`/`action` text is unchanged.
- Metadata is passed as a parameterized `$n::jsonb` argument and never interpolated into SQL text.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` exit 0.

## Files to touch

- `server/records.ts`
- `server/auth.ts`
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Test expectations

- Configure: disposable `TEST_DATABASE_URL` (see `CONTRIBUTING.md`)
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Adding new audit actions, changing the `/api/audit` response contract, or database-enforced append-only controls.

## Depends on

None
