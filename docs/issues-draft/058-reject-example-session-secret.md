# Reject the Example Placeholder Session Secret at Startup

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 2

## Problem statement

Operators who copy the checked-in template `.env.example:22` (the `SESSION_SECRET=replace-with-at-least-32-random-bytes` line) get a secret that passes every current check: the length guard in `validateEnvironment` (`server/environment.ts:40-43`) and the module-level guard in `server/auth.ts:26-28` only verify byte length, and unlike `PSEUDONYM_SECRET` (the placeholder check in `resolvePseudonymSecret`, `server/pseudonym.ts:6-9`) the session secret is never tested for the `replace-with-` placeholder prefix. A known `SESSION_SECRET` is used to derive CSRF tokens (`makeCsrfToken`, `server/auth.ts:35-36`) and to sign pagination cursors (the `createHmac(... process.env.SESSION_SECRET ...)` calls in `readPage`/`sendPage` at `server/records.ts:384`, `server/records.ts:398`, `server/records.ts:479`, `server/records.ts:489`), so a predictable value undermines cursor integrity and secret separation. Affected: operators deploying from the template, and any user relying on cursor/CSRF integrity.

## Technical implementation requirements

- Reject a configured `SESSION_SECRET` whose value starts with `replace-with-` (case-insensitive) in `validateEnvironment` and in the module-level guard in `server/auth.ts`.
- Report only the variable name; never echo the secret value.
- Preserve the existing minimum-length rule and the documented development-only `PSEUDONYM_SECRET` fallback (the `developmentOnlyPseudonymFallback` return in `resolvePseudonymSecret`, `server/pseudonym.ts:12-14`).
- Do NOT change the HMAC, session, or cursor algorithms, and do NOT change the required-key list.

## Files and areas to touch

- `server/environment.ts`
- `server/auth.ts`
- `tests/environment.test.ts`
- `docs/security.md`

## Dependencies

- None. Distinct from the secret-reuse equality check already tracked separately.

## Measurable acceptance criteria

- A test in `tests/environment.test.ts` asserts `validateEnvironment` throws when `SESSION_SECRET` begins with `replace-with-`, and the thrown message names `SESSION_SECRET` and contains no part of the secret value.
- A test asserts a 32+ byte non-placeholder `SESSION_SECRET` still passes `validateEnvironment`.
- `npm test -- tests/environment.test.ts` passes.
- `npm run typecheck` passes.
- No secret value appears in any thrown message.

## Expected deliverables

- Placeholder rejection in both guard sites, unit tests, and a one-line security-doc note.

## How to set up and run tests

- Run `npm test -- tests/environment.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- Secret rotation, secret-manager integration, changing required keys, or altering wallet login.

## Suggested labels

- `area: security`, `area: backend`, `type: bug`, `difficulty: medium`.
