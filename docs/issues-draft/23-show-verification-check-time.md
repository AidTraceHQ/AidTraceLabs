# Show the Last Verification Check Time

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 3

## Problem statement

Verification responses carry `checkedAt`, but the record detail view shows status/reason without telling the reviewer when that status was checked.

## Technical implementation requirements

- Render the existing timestamp when present, with locale-aware display and a stable accessible label.
- Preserve privacy projection behavior when verification details are withheld.
- Clearly distinguish check time from transaction creation time and record creation time.

## Files and areas to touch

- `src/App.tsx`
- `tests/` (focused verification-detail rendering test)
- `docs/api.md` only if response semantics need clarification

## Dependencies

- None. Existing GitHub issue #18 automates future reverification; this draft only displays existing metadata.

## Measurable acceptance criteria

- A test renders verified, mismatch, not-found, and pending results and asserts the last check time is shown when the API provides `checkedAt`.
- A test with a missing or undefined `checkedAt` asserts a neutral fallback renders without throwing.
- A test asserts consent-off public views do not render withheld verification fields.
- `npm test -- tests/api.test.ts` passes.

## Expected deliverables

- Detail-view timestamp and focused display/privacy tests.

## How to set up and run tests

- `npm test -- tests/api.test.ts`
- `npm run typecheck`

## Out of scope

- Scheduled checks, changing cache policy, or modifying Stellar verification logic.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: medium`.
