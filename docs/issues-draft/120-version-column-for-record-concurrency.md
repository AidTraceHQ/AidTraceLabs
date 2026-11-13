# Replace Millisecond-Timestamp Concurrency With a Version Column

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 16 hours

**Release day:** Day 1

## Problem statement

Editing a record guards against lost updates by comparing a timestamp truncated to the millisecond:

```
WHERE id = $1 AND organization_wallet = $14 AND voided_at IS NULL
  AND date_trunc('milliseconds', updated_at) IS NOT DISTINCT FROM $15
```

(`server/records.ts:944-969`, the `date_trunc` clause is line 951, with the client-supplied
`updated_at` bound at line 967). `updated_at` itself is a plain `TIMESTAMPTZ` column
(`migrations/001_initial_schema.sql:65`) with no sequence or version, and the value written on update is
`NOW()` (`server/records.ts:949`).

Two problems follow from that design:

1. Two edits that land in the **same millisecond** truncate to the same value, so the second edit
   passes the guard and silently overwrites the first — the exact lost update the guard exists to
   prevent. PostgreSQL's `NOW()` is transaction-start time, so concurrent transactions started inside
   the same millisecond are indistinguishable.
2. The guard depends on client round-tripping a timestamp with only millisecond resolution. Any
   serialization that loses or rounds microseconds (the column itself is microsecond-resolution) makes
   a legitimate edit fail with the "Record changed concurrently" 409
   (`server/records.ts:993-995`) even when nothing changed.

Affected: organizations editing a record from two tabs or two admins reviewing the same record; the
failure mode is either a silent overwrite or a spurious 409.

## Technical implementation requirements

- Add a forward-only migration that adds a monotonic version to `aid_records`, for example
  `version INTEGER NOT NULL DEFAULT 1` (or `BIGINT`), and backfill existing rows to `1`.
- Change the PUT update to compare on the version instead of the truncated timestamp and to increment
  it atomically in the same statement:
  `... SET ..., version = version + 1 WHERE id = $1 AND ... AND version = $n`.
- Return `version` in the record projection used by `GET /api/transparency`, `GET /api/beneficiary`,
  `POST /api/records`, and `PUT /api/records/:id`, so the client can send the version it last read.
- Keep the existing 409 behaviour and message when the version does not match
  (`server/records.ts:993-996`); do not change the status code.
- Keep the earlier checks unchanged: 404 for a missing record, 403 for a non-owner, 409 for an already
  voided record (`server/records.ts:921-935`).
- Do not change the record API's request field names for existing fields; add the expected version as a
  new field (for example `expectedVersion`) and treat it as optional so existing clients keep working —
  when it is omitted, the update applies without the concurrency check, matching today's behaviour for a
  client that sends no `updatedAt`.
- Do not touch authentication, Stellar verification, or the unique `(network, tx_hash)` constraint from
  migration 002.
- Document the new field and the 409 semantics in `docs/api.md`.

## Files and areas to touch

- `migrations/004_record_version.sql` (next free number; migrations 001-002 exist plus any added by
  other drafts, so confirm the number at implementation time)
- `server/records.ts` (`getRecord` projection, the PUT handler at 916-1027, and the create path)
- `src/api.ts` and `src/App.tsx` (send `expectedVersion` from the loaded record)
- `tests/backend.test.ts`
- `docs/api.md`

## Dependencies

- Interacts with draft "Enforce Hash and Asset-Issuer Invariants in PostgreSQL" (record integrity constraints migration) and draft "Align filtered record pagination with an ordering index" (pagination index):
  all three add forward-only migrations, so they must agree on the next free migration number. None of
  them changes the same column.

## Measurable acceptance criteria

- A fresh schema has `aid_records.version` as `NOT NULL`, and `npm run db:migrate` is idempotent.
- Two updates issued with the same `expectedVersion` cause exactly one success and one 409; the stored
  row reflects exactly one update.
- Two updates started in the same millisecond no longer both succeed (a database-backed test forces this
  with two sequential statements carrying the same version).
- A record updated without `expectedVersion` still succeeds, preserving current client behaviour.
- The version increments by exactly one per successful update and is returned by the list and single
  record responses.
- `npm test -- tests/backend.test.ts`, `npm run typecheck`, and `npm run lint` pass.

## Expected deliverables

- The migration, the rewritten concurrency guard and projection, the client change that sends the
  version, database-backed tests, and the `docs/api.md` update.

## How to set up and run tests

- Use a disposable `TEST_DATABASE_URL` as described in `CONTRIBUTING.md:39`.
- `npm run db:migrate`
- `npm test -- tests/backend.test.ts`
- Manual: `npm run dev`, open the same record in two tabs, save in both, and confirm the second save
  reports the concurrent-change conflict instead of overwriting.

## Out of scope

- Introducing ETags/If-Match headers, changing the 409 status code, adding revision history tables, or
  altering how `verification_results` history is written.

## Suggested labels

- `area: data`, `area: backend`, `type: bug`, `difficulty: high`.
