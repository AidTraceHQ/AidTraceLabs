# Replace Millisecond-Timestamp Concurrency With a Version Column

**Complexity:** high

## Context

Editing a record guards against lost updates by comparing a timestamp truncated to the millisecond in `server/records.ts` (the `date_trunc` clause at line 951, with the client-supplied `updated_at` bound at line 967, within the PUT handler at lines 944–969). Two edits that land in the same millisecond truncate to the same value, so the second edit passes the guard and silently overwrites the first. Additionally, any serialization that loses microseconds makes a legitimate edit fail with the "Record changed concurrently" 409 (lines 993–995) even when nothing changed. Affected: organizations editing a record from two tabs or two admins reviewing the same record concurrently. Current behavior: same-millisecond concurrent edits can both succeed. Expected behavior: a monotonic version column guards updates atomically.

## Acceptance criteria

- A fresh schema has `aid_records.version` as `NOT NULL`, and `npm run db:migrate` is idempotent.
- Two updates issued with the same `expectedVersion` cause exactly one success and one 409; the stored row reflects exactly one update.
- Two updates started in the same millisecond no longer both succeed (a database-backed test forces this with two sequential statements carrying the same version).
- A record updated without `expectedVersion` still succeeds, preserving current client behavior.
- The version increments by exactly one per successful update and is returned by the list and single record responses.
- `npm test -- tests/backend.test.ts`, `npm run typecheck`, and `npm run lint` pass.

## Files to touch

- `migrations/004_record_version.sql` (next free number; confirm at implementation time)
- `server/records.ts` (`getRecord` projection, PUT handler lines 916–1027, and create path)
- `src/api.ts`
- `src/App.tsx`
- `tests/backend.test.ts`
- `docs/api.md`

## Test expectations

- Configure: disposable `TEST_DATABASE_URL` (see `CONTRIBUTING.md`)
- Run: `npm run db:migrate`
- Run: `npm test -- tests/backend.test.ts`
- Manual: run `npm run dev`, open the same record in two tabs, save in both, and confirm the second save reports the concurrent-change conflict.

## Out of scope

Introducing ETags/If-Match headers, changing the 409 status code, adding revision history tables, or altering how `verification_results` history is written.

## Depends on

Enforce Hash and Asset-Issuer Invariants in PostgreSQL, Align filtered record pagination with an ordering index
