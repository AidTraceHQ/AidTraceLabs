# Reject Reuse of Session and Pseudonym Secrets

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 2 hours

**Release day:** Day 1

## Problem statement

Security documentation requires distinct `SESSION_SECRET` and `PSEUDONYM_SECRET`, but the `validateEnvironment` secret checks only test their lengths/placeholders (`server/environment.ts:40-49`; the "Secret handling" section at `docs/security.md:15-20`). Accidental copy/paste reuse currently passes validation.

## Technical implementation requirements

- Compare the configured values without including either value in an error.
- Reject equality in production and development when both explicit values are set.
- Keep the documented development-only pseudonym fallback behavior intact.

## Files and areas to touch

- `server/environment.ts`
- `tests/environment.test.ts`
- `docs/security.md`

## Dependencies

- None.

## Measurable acceptance criteria

- Test `rejects identical SESSION_SECRET and PSEUDONYM_SECRET` in `tests/environment.test.ts` asserts `validateEnvironment` throws a message naming both variables and containing neither value.
- Test `accepts distinct secrets of at least 32 bytes` asserts no throw.
- Existing development-fallback and missing-key tests in `tests/environment.test.ts` still pass.
- `npm test -- tests/environment.test.ts` passes.

## Expected deliverables

- Startup validation, equality/mismatch tests, and a short security-doc clarification.

## How to set up and run tests

- Run `npm test -- tests/environment.test.ts` and `npm run typecheck`.

## Out of scope

- Key rotation automation, secret-manager integration, or changes to HMAC/session algorithms.

## Suggested labels

- `area: security`, `type: bug`, `difficulty: trivial`.
