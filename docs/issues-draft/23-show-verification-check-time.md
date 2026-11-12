# Show the Last Verification Check Time

**Publish:** Day 3

**Size:** Medium

## Problem statement

Verification responses carry `checkedAt`, but the record detail view shows status/reason without telling the reviewer when that status was checked.

## Technical requirements

- Render the existing timestamp when present, with locale-aware display and a stable accessible label.
- Preserve privacy projection behavior when verification details are withheld.
- Clearly distinguish check time from transaction creation time and record creation time.

## Files to touch

- `src/App.tsx`
- `tests/` (focused verification-detail rendering test)
- `docs/api.md` only if response semantics need clarification

## Dependencies on other issues

- None. #18 automates future reverification; this draft only displays existing metadata.

## Acceptance criteria

- Details show the last check time for verified, mismatch, not-found, and pending results when the API provides it.
- Missing timestamps render a neutral fallback without throwing.
- Consent-off public views do not reveal withheld fields.

## Deliverables

- Detail-view timestamp and focused display/privacy tests.

## How to run tests

- `npm test -- tests/api.test.ts`
- `npm run typecheck`

## Out of scope

- Scheduled checks, changing cache policy, or modifying Stellar verification logic.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: medium`.
