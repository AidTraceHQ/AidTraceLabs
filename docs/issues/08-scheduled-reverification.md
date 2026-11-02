# Scheduled Re-Verification

**Complexity:** high

## Context

AidTrace currently verifies on record creation and on an authenticated request. A scheduled worker could refresh stale results without making the public page issue requests.

## Acceptance criteria

- Define a bounded, observable job model for stale eligible records.
- Prevent duplicate concurrent checks and respect existing Horizon limits.
- Preserve verification history and mark transient failures pending.
- Do not introduce a hosted scheduler or claim operational availability without deployment evidence.

## Files to touch

- `server/records.ts` or a focused service under `server/`
- `server/stellar-verification.ts`
- `migrations/` if job state is needed
- `tests/backend.test.ts`

## Test expectations

- Cover eligibility, retries, concurrent claims, history retention, and Horizon failure.
- Run `npm run check` and migration tests against disposable PostgreSQL.
