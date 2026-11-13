# Populate structured metadata on audit events

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 3

## Problem statement

`audit_events` declares `metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb`
(`migrations/001_initial_schema.sql:112`), but every audit write omits it. The record-side `writeAudit`
helper inserts only `(id, action, actor_wallet, subject_wallet, record_id, summary)`
(`server/records.ts:298-309`), and the auth-side writes insert only `(id, action, actor_wallet, summary)`
(`server/auth.ts:166-172`, the `audit()` helper, and `server/auth.ts:307-311`, the inline INSERT in the verify
handler). As a result, `metadata_json` is always `'{}'`: audit entries carry only a free-text summary and cannot
be grouped or filtered by structured values. Concrete losses include the previous role on a role change (the
`writeAudit` call in the `POST /api/admin/roles` handler only interpolates the old role into a summary string,
`server/records.ts:1163-1170`) and the verification status/ledger on verification events. Affected: admins
reviewing audit history who need structured, queryable detail.

## Technical implementation requirements

- Persist structured, non-secret metadata for the existing audited actions (for example: prior and new role
  for `wallet_role_changed`, verification status/ledger for verification events, void reason reference for
  `record_voided`). Reuse the values the handlers already have.
- Pass metadata as a parameterized `$n::jsonb` argument; never interpolate it into SQL text. Bound the
  serialized size.
- Do NOT store secrets, session/CSRF tokens, full recipient PII, or the pseudonym key. Keep summary strings
  and existing action names unchanged; metadata is additive.
- Do not change authentication, role checks, or append-only audit controls.

## Files and areas to touch

- `server/records.ts`
- `server/auth.ts`
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Dependencies

- None. Distinct from the append-only audit draft; this is about writing the existing column's data.

## Measurable acceptance criteria

- After a role change and a record void, a direct query (or `/api/audit`) asserts the `wallet_role_changed`
  row's `metadata_json` contains the previous and new role, the `record_voided` row carries the void reason,
  and no stored value equals the actor's session or CSRF token (asserted in `tests/backend.test.ts`).
- Existing audit-related integration tests still pass, and the stored `summary`/`action` text is unchanged.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` exit 0.

## Expected deliverables

- Metadata capture on the existing audit write paths, tests asserting stored metadata, and a short note in
  `docs/backend-design.md` describing the metadata shape per action.

## How to set up and run tests

- Configure the disposable `TEST_DATABASE_URL` described in `CONTRIBUTING.md`, then
  `npm test -- tests/backend.test.ts` and `npm run typecheck`.

## Out of scope

- Adding new audit actions, changing the `/api/audit` response contract, or database-enforced append-only
  controls.

## Suggested labels

- `area: data`, `type: enhancement`, `difficulty: medium`
