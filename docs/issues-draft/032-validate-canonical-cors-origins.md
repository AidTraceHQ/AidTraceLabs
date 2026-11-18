# Validate CORS Configuration as Canonical Origins

**Complexity:** intermediate

## Context

`validateEnvironment` in `server/environment.ts` (the CORS block at lines 69Ã¢â‚¬â€œ90) accepts any parseable URL for `CORS_ALLOWED_ORIGINS`. Request handling compares raw configured strings to the browser's origin using the module-level `allowedOrigins` set and `isAllowedOrigin` in `server/http-security.ts` (lines 3Ã¢â‚¬â€œ12). A path, query, credentials, or trailing slash can pass startup validation and then deny legitimate requests. Affected users: developers and operators whose CORS configuration silently fails to match browser origins. Current behavior: any parseable URL is accepted; trailing slashes or paths cause silent request denial. Expected behavior: every entry is parsed as a canonical origin only (scheme, host, optional port; no credentials, path, query, or fragment). HTTP is allowed for explicit local development; HTTPS is required for non-local origins. Wildcard credentialed CORS must never be introduced.

## Acceptance criteria

- Test `accepts canonical localhost and HTTPS origins and matches the request Origin exactly` asserts the echoed `Access-Control-Allow-Origin` equals the request `Origin`.
- Test `rejects paths, trailing slashes, query strings, credentials, and unsupported schemes at startup` asserts `validateEnvironment` throws and the message echoes none of the input values.
- A middleware test asserts a non-canonical `Origin` returns `403` with no `Access-Control-Allow-Origin` header.
- Credentialed exact-match behavior is asserted: valid preflight returns `Access-Control-Allow-Credentials: true` and no wildcard `*` origin.
- `npm test -- tests/environment.test.ts tests/backend.test.ts` passes.

## Files to touch

- `server/environment.ts`
- `server/http-security.ts`
- `tests/environment.test.ts`
- `tests/backend.test.ts`
- `docs/deployment.md`

## Test expectations

- Run: `npm test -- tests/environment.test.ts tests/backend.test.ts` with database integration disabled for unit/API cases.
- Run: `npm run typecheck`

## Out of scope

Changing the wallet login protocol, enabling cross-site cookies, or broadening allowed origins.

## Depends on

None
