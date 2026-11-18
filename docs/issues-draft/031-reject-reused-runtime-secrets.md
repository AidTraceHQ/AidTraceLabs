# Reject Reuse of Session and Pseudonym Secrets

**Complexity:** beginner

## Context

Security documentation requires distinct `SESSION_SECRET` and `PSEUDONYM_SECRET`, but `validateEnvironment` in `server/environment.ts` (the secret checks at lines 40Ã¢â‚¬â€œ49) tests only their lengths and placeholder prefixes. Accidental copy/paste reuse of the same value for both secrets currently passes validation. Affected users: operators who accidentally configure identical secrets and operators relying on cursor/CSRF integrity. Current behavior: equal `SESSION_SECRET` and `PSEUDONYM_SECRET` values pass validation. Expected behavior: validation rejects equality in production and development when both explicit values are set; the error names both variables but contains neither value. Evidence: `server/environment.ts` (function `validateEnvironment`, lines 40Ã¢â‚¬â€œ49) and `docs/security.md` ("Secret handling" section at lines 15Ã¢â‚¬â€œ20).

## Acceptance criteria

- Test `rejects identical SESSION_SECRET and PSEUDONYM_SECRET` in `tests/environment.test.ts` asserts `validateEnvironment` throws a message naming both variables and containing neither value.
- Test `accepts distinct secrets of at least 32 bytes` asserts no throw.
- Existing development-fallback and missing-key tests in `tests/environment.test.ts` still pass.
- `npm test -- tests/environment.test.ts` passes.

## Files to touch

- `server/environment.ts`
- `tests/environment.test.ts`
- `docs/security.md`

## Test expectations

- Run: `npm test -- tests/environment.test.ts`
- Run: `npm run typecheck`
- No database required.

## Out of scope

Key rotation automation, secret-manager integration, or changes to HMAC/session algorithms.

## Depends on

None
