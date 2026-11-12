# Audit Security-Relevant Rejections

**Publish:** Day 1

**Size:** Medium

## Problem statement

Failed signatures, invalid/expired/replayed challenges, CSRF/origin denials, and rate-limit rejections are not comprehensively represented in audit events.

## Technical requirements

- Define a bounded event taxonomy and add audit entries for selected security-relevant rejection outcomes.
- Never store signatures, cookies, CSRF tokens, raw request bodies, or database URLs.
- Avoid turning hostile requests into an unbounded audit-storage denial of service.

## Files to touch

- `server/auth.ts`
- `server/records.ts`
- `server/http-security.ts`
- `tests/backend.test.ts`
- `docs/security.md`

## Dependencies on other issues

- None. #15 concerns viewing/filtering audit records, not event capture.

## Acceptance criteria

- The documented event categories are emitted with safe, bounded metadata.
- Tests prove sensitive request values are not persisted.
- Rate-limit and database failure behavior remains bounded and non-recursive.

## Deliverables

- Selective rejection auditing, security-focused tests, and an updated event inventory.

## How to run tests

- `npm test -- tests/backend.test.ts tests/rate-limits.test.ts`
- `npm run typecheck`

## Out of scope

- Rewriting wallet authentication or recording every ordinary validation error.

## Suggested labels

- `area: security`, `area: backend`, `type: enhancement`, `difficulty: medium`.
