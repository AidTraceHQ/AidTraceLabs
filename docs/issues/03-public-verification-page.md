# Public Verification Page

**Complexity:** high

## Context

The public ledger displays verification status, but a focused shareable record view would let reviewers inspect the checked fields without granting access to administrative views.

## Acceptance criteria

- Add a public, read-only view keyed by a non-secret record identifier.
- Apply the same consent-aware projection as the public transparency endpoint.
- Show network, verification outcome, checked fields, and a clear statement of what verification does not prove.
- Return a useful not-found state without leaking private record fields.

## Files to touch

- `src/App.tsx`
- `src/api.ts`
- `server/records.ts` only if an existing public route cannot support the view
- `tests/api.test.ts` and/or `tests/backend.test.ts`

## Test expectations

- Cover consent-off, consent-on, missing record, and verified/mismatch states.
- Confirm the page requires no session and does not reveal withheld identifiers.
- Run `npm run check`.
