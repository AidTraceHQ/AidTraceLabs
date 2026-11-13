# Audit Security-Relevant Rejections

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 1

## Problem statement

Failed signatures, invalid/expired/replayed challenges, CSRF/origin denials, and rate-limit rejections are not comprehensively represented in audit events.

## Technical implementation requirements

- Define a bounded event taxonomy and add audit entries for selected security-relevant rejection outcomes.
- Never store signatures, cookies, CSRF tokens, raw request bodies, or database URLs.
- Avoid turning hostile requests into an unbounded audit-storage denial of service.

## Files and areas to touch

- `server/auth.ts`
- `server/records.ts`
- `server/http-security.ts`
- `tests/backend.test.ts`
- `docs/security.md`

## Dependencies

- None. Existing GitHub issue #15 concerns viewing/filtering audit records, not event capture.

## Measurable acceptance criteria

- A test per documented category (failed signature, invalid/expired/replayed challenge, CSRF/origin denial, rate-limit rejection) asserts an audit event is emitted with the documented bounded fields only.
- A test asserts no emitted audit event contains a signature, cookie, CSRF token, raw request body, or database URL.
- A test asserts repeated hostile requests produce a bounded number of audit writes and that rate-limit/database failures do not recursively audit.
- `npm test -- tests/backend.test.ts tests/rate-limits.test.ts` passes.

## Expected deliverables

- Selective rejection auditing, security-focused tests, and an updated event inventory.

## How to set up and run tests

- `npm test -- tests/backend.test.ts tests/rate-limits.test.ts`
- `npm run typecheck`

## Out of scope

- Rewriting wallet authentication or recording every ordinary validation error.

## Suggested labels

- `area: security`, `area: backend`, `type: enhancement`, `difficulty: medium`.
