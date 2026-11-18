# Define Security Headers for API and Static Responses

**Complexity:** intermediate

## Context

The API disables `X-Powered-By`, but no deliberate browser security-header policy is set in Express or Vercel configuration. Affected users: all users of the application whose browsers lack the signal to enforce framing, referrer, permissions, and transport security policies. Current behavior: no `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, or `Strict-Transport-Security` headers are sent. Expected behavior: compatible values for content-type sniffing, framing, referrer, permissions, and transport security are configured for both API and static responses; wallet/Freighter flows and required external Horizon/explorer links continue to work. Evidence: `server/app.ts` (middleware chain) and `vercel.json` (no headers block).

## Acceptance criteria

- A test asserts the frontend and API responses carry the documented headers with the documented values (content-type sniffing, framing, referrer, permissions, transport security).
- A test asserts any introduced CSP contains no wildcard source (`*`) and lists only documented required sources.
- Existing wallet/Freighter and external-link route tests still pass.
- `npm run build` succeeds.
- `npm test -- tests/backend.test.ts` passes.

## Files to touch

- `server/app.ts`
- `vercel.json`
- `tests/backend.test.ts`
- `docs/deployment.md`

## Test expectations

- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run build`
- Run: `npm run typecheck`

## Out of scope

Changing authentication, CORS allowlists, or wallet signing behavior.

## Depends on

None
