# Audit Security-Relevant Rejections

**Complexity:** intermediate

## Context

Failed signatures, invalid/expired/replayed challenges, CSRF/origin denials, and rate-limit rejections are not comprehensively captured in audit events. Affected users: security operators reviewing logs after a suspected attack. Current behavior: rejection events are silently dropped; audit events exist only for successful mutations. Expected behavior: a bounded set of security-relevant rejection categories each produce an audit entry with documented safe fields only. Privacy constraint: audit entries must never store signatures, cookies, CSRF tokens, raw request bodies, or database URLs. Rate-limiting constraint: hostile traffic must not cause unbounded audit-storage writes. Evidence: `server/auth.ts` (challenge/signature handling), `server/records.ts` (CSRF and role checks), `server/http-security.ts` (origin validation).

## Acceptance criteria

- A test per documented category (failed signature, invalid/expired/replayed challenge, CSRF/origin denial, rate-limit rejection) asserts an audit event is emitted with the documented bounded fields only.
- A test asserts no emitted audit event contains a signature, cookie, CSRF token, raw request body, or database URL.
- A test asserts repeated hostile requests produce a bounded number of audit writes and that rate-limit or database failures do not recursively trigger more audit writes.
- `npm test -- tests/backend.test.ts tests/rate-limits.test.ts` passes.

## Files to touch

- `server/auth.ts`
- `server/records.ts`
- `server/http-security.ts`
- `tests/backend.test.ts`
- `docs/security.md`

## Test expectations

- Run: `npm test -- tests/backend.test.ts tests/rate-limits.test.ts`
- Run: `npm run typecheck`
- Requires `TEST_DATABASE_URL` and `TEST_DATABASE_BRANCH=test` for integration cases.

## Out of scope

Rewriting wallet authentication or recording every ordinary validation error. Audit filters are tracked by a separate open issue.

## Depends on

None
