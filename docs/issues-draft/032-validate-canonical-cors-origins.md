# Validate CORS Configuration as Canonical Origins

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 3

## Problem statement

The `validateEnvironment` CORS block accepts any parseable URL for `CORS_ALLOWED_ORIGINS` (`server/environment.ts:69-90`), but request handling compares the raw configured strings to the browser's origin using the module-level `allowedOrigins` set and `isAllowedOrigin` (`server/http-security.ts:3-12`). A path, query, credentials, or trailing slash can pass startup and then deny legitimate requests.

## Technical implementation requirements

- Parse every comma-separated entry once and require it to be an origin only: scheme, host, optional port; no credentials, path, query, or fragment.
- Allow HTTP for explicit local development origins; require HTTPS for non-local production origins.
- Preserve exact origin matching; do not introduce wildcard credentialed CORS.

## Files and areas to touch

- `server/environment.ts`
- `server/http-security.ts`
- `tests/environment.test.ts`
- `tests/backend.test.ts`
- `docs/deployment.md`

## Dependencies

- None.

## Measurable acceptance criteria

- Test `accepts canonical localhost and HTTPS origins and matches the request Origin exactly` asserts the echoed `Access-Control-Allow-Origin` equals the request `Origin`.
- Test `rejects paths, trailing slashes, query strings, credentials, and unsupported schemes at startup` asserts `validateEnvironment` throws and the message echoes none of the input values.
- A middleware test asserts a non-canonical `Origin` returns `403` with no `Access-Control-Allow-Origin` header.
- Credentialed exact-match behavior is asserted: valid preflight returns `Access-Control-Allow-Credentials: true` and no wildcard `*` origin.
- `npm test -- tests/environment.test.ts tests/backend.test.ts` passes.

## Expected deliverables

- Canonical origin parser/validation, unit and middleware tests, and config examples.

## How to set up and run tests

- Run `npm test -- tests/environment.test.ts tests/backend.test.ts` with DB integration disabled for unit/API cases.
- Run `npm run typecheck`.

## Out of scope

- Changing the wallet login protocol, enabling cross-site cookies, or broadening allowed origins.

## Suggested labels

- `area: security`, `area: backend`, `type: bug`, `difficulty: medium`.
