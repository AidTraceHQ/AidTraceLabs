# Add Correlated, Redacted API Error Logs

**Complexity:** medium

## Context

Unexpected API errors are logged without a request ID or structured safe fields, making hosted failures difficult to correlate while risking overly broad error serialization. Affected users: operators diagnosing API failures in hosted environments. Current behavior: errors are logged with only the raw error object; no request ID is included. Expected behavior: each request receives a correlation ID that is returned in a response header and included in the structured error log. Log lines must contain only method, route template, status, request ID, and a safe error category — never request bodies, cookies, signatures, tokens, full URLs with query strings, or database connection details. Evidence: `server/app.ts` (error handler at the `console.error('Unhandled API error:', error)` call).

## Acceptance criteria

- A test triggers a failed request and asserts the request ID in the response header equals the request ID in the emitted structured log event.
- A test asserts emitted log output contains no request bodies, cookies, signatures, tokens, or query strings.
- A test asserts existing generic client error responses remain unchanged.
- `npm test -- tests/backend.test.ts` passes.

## Files to touch

- `server/app.ts`
- `server/http-security.ts` (or a new request-context middleware)
- `tests/backend.test.ts`
- `docs/security.md`

## Test expectations

- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

A hosted observability vendor, tracing SDK, or logging request payloads.

## Depends on

None
