# Show the Last Verification Check Time

**Complexity:** medium

## Context

Verification responses carry a `checkedAt` timestamp, but the record detail view shows verification status and reason without telling the reviewer when that status was last checked. Affected users: reviewers and auditors who need to know whether a verification status is current or stale. Current behavior: the detail view renders status/reason only; `checkedAt` is not displayed. Expected behavior: when `checkedAt` is present in the API response, the record detail view renders the timestamp with locale-aware display and a stable accessible label. The display must clearly distinguish check time from transaction creation time and record creation time. Privacy: consent-off public views must not render withheld verification fields. Evidence: `src/App.tsx` (record detail rendering) and `server/records.ts` (the `verification` object in `recordSelect`, function `recordSelect`).

## Acceptance criteria

- A test renders verified, mismatch, not-found, and pending results and asserts the last check time is shown when the API provides `checkedAt`.
- A test with a missing or undefined `checkedAt` asserts a neutral fallback renders without throwing.
- A test asserts consent-off public views do not render withheld verification fields.
- `npm test -- tests/api.test.ts` passes.

## Files to touch

- `src/App.tsx`
- `tests/` (focused verification-detail rendering test)
- `docs/api.md` (only if response semantics need clarification)

## Test expectations

- Run: `npm test -- tests/api.test.ts`
- Run: `npm run typecheck`
- No database required for rendering tests.

## Out of scope

Scheduled checks, changing cache policy, or modifying Stellar verification logic. Scheduled re-verification is tracked by a separate open issue.

## Depends on

None
