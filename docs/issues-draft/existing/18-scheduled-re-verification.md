# Scheduled Re-Verification

**Complexity:** high

## Context

Verification is request-driven only. It runs on record creation (`server/records.ts:789`,
calling `recordVerification()` at `server/records.ts:615`) and on `POST
/api/records/:id/verify` (`server/records.ts:870`), and a result is cached for one hour
only when it is `verified` or `mismatch` (`cachedVerification()`, `server/records.ts:679`;
the cache window is set in `storeVerification()`, `server/records.ts:641`). There is no
scheduler anywhere in the repository: `server/` contains no `cron`, `setInterval` or worker,
and the only scheduled workflows are CodeQL and Dependabot in `.github/`.

Affected users: reviewers relying on a public page that shows stale verification results.
Current behavior: a record stays stale until someone re-opens or re-verifies it. Expected
behavior: a bounded, observable background job refreshes stale, eligible records without
making the public page issue Horizon requests. Decision required first (scope the job model
before implementing).

## Acceptance criteria

- A job runner refreshes records whose latest verification is older than a documented
  staleness window; eligibility is explicit and a per-run count is observable (log line or
  metric).
- Concurrent runs cannot double-check the same record: a record is claimed/locked in the
  database before its Horizon call.
- Each run processes a bounded batch size and stays within the existing Horizon request
  limits.
- Verification history is preserved: new rows are appended and existing rows are never
  edited. A transient Horizon failure leaves the record pending, never a final mismatch.
- No hosted scheduler is introduced or assumed. The runner is invocable locally (script or
  command) and documented as operator-run until deployment evidence exists.
- `npm run check` passes and the migration tests pass against a disposable PostgreSQL.

## Files to touch

- `server/` (new focused job/service, or `server/records.ts`)
- `server/stellar-verification.ts`
- `migrations/` (only if job/claim state must be persisted)
- `tests/backend.test.ts`
- `docs/` (runbook section)

## Test expectations

- Cover eligibility selection, batch bound, concurrent-claim exclusion, history retention,
  and a Horizon failure that leaves a record pending.
- Run `npm run check`, plus the migration tests against a disposable PostgreSQL.

## Out of scope

A hosted Vercel cron or any operational-availability claim, changing the payment-matching
algorithm, and outbound alerting.

## Depends on

None
