# Reject the Example Placeholder Session Secret at Startup

**Complexity:** medium

## Context

Operators who copy the checked-in template get a `SESSION_SECRET` of `replace-with-at-least-32-random-bytes` from `.env.example` (line 22). This passes every current check: the length guard in `validateEnvironment` in `server/environment.ts` (lines 40–43) and the module-level guard in `server/auth.ts` (lines 26–28) verify only byte length. Unlike `PSEUDONYM_SECRET` (the placeholder check in function `resolvePseudonymSecret` in `server/pseudonym.ts`, lines 6–9), the session secret is never tested for the `replace-with-` prefix. A known `SESSION_SECRET` is used to derive CSRF tokens (function `makeCsrfToken` in `server/auth.ts`, lines 35–36) and to sign pagination cursors (the `createHmac` calls in functions `readPage`/`sendPage` in `server/records.ts`, lines 384, 398, 479, 489), so a predictable value undermines cursor integrity and secret separation. Affected: operators deploying from the template.

## Acceptance criteria

- A test in `tests/environment.test.ts` asserts `validateEnvironment` throws when `SESSION_SECRET` begins with `replace-with-`, and the thrown message names `SESSION_SECRET` and contains no part of the secret value.
- A test asserts a 32+ byte non-placeholder `SESSION_SECRET` still passes `validateEnvironment`.
- `npm test -- tests/environment.test.ts` passes.
- `npm run typecheck` passes.
- No secret value appears in any thrown message.

## Files to touch

- `server/environment.ts`
- `server/auth.ts`
- `tests/environment.test.ts`
- `docs/security.md`

## Test expectations

- Run: `npm test -- tests/environment.test.ts`
- Run: `npm run typecheck`

## Out of scope

Secret rotation, secret-manager integration, changing required keys, or altering wallet login.

## Depends on

None
