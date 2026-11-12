# Reject Reuse of Session and Pseudonym Secrets

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 2 hours

**Release day:** Day 1

## Problem statement

Security documentation requires distinct `SESSION_SECRET` and `PSEUDONYM_SECRET`, but startup checks only their lengths/placeholders (`server/environment.ts:40-49`; `docs/security.md:15-20`). Accidental copy/paste reuse currently passes validation.

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

- Equal explicit keys fail validation with a message naming the variables only.
- Different valid keys pass.
- Existing development fallback and missing-key behavior remains unchanged.

## Expected deliverables

- Startup validation, equality/mismatch tests, and a short security-doc clarification.

## How to set up and run tests

- Run `npm test -- tests/environment.test.ts` and `npm run typecheck`.

## Out of scope

- Key rotation automation, secret-manager integration, or changes to HMAC/session algorithms.

## Suggested labels

- `area: security`, `type: bug`, `difficulty: trivial`.
