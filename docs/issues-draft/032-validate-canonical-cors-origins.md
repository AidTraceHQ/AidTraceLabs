# Validate CORS Configuration as Canonical Origins

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 3

## Problem statement

Environment validation accepts any parseable URL for `CORS_ALLOWED_ORIGINS` (`server/environment.ts:69-90`), but request handling compares the raw configured strings to the browser's origin (`server/http-security.ts:3-12`). A path, query, credentials, or trailing slash can pass startup and then deny legitimate requests.

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

- Canonical localhost and HTTPS origins validate and match request Origin exactly.
- Paths, trailing slashes, query strings, credentials, unsupported schemes, and malformed entries fail startup with no values echoed.
- CORS remains exact-match and credentialed; no wildcard behavior is added.

## Expected deliverables

- Canonical origin parser/validation, unit and middleware tests, and config examples.

## How to set up and run tests

- Run `npm test -- tests/environment.test.ts tests/backend.test.ts` with DB integration disabled for unit/API cases.
- Run `npm run typecheck`.

## Out of scope

- Changing the wallet login protocol, enabling cross-site cookies, or broadening allowed origins.

## Suggested labels

- `area: security`, `area: backend`, `type: bug`, `difficulty: medium`.
