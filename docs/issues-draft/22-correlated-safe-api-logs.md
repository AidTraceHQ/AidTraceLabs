# Add Correlated, Redacted API Error Logs

**Publish:** Day 3

**Size:** Medium

## Problem statement

Unexpected API errors are logged without a request ID or structured safe fields, making hosted failures difficult to correlate while risking overly broad error serialization.

## Technical requirements

- Assign or validate a request ID, return it in a response header, and include it in structured error logs.
- Log only method, route template, status, request ID, and a safe error category.
- Never log request bodies, cookies, signatures, tokens, full URLs with query strings, or database connection details.

## Files to touch

- `server/app.ts`
- `server/http-security.ts` or a new request-context middleware
- `tests/backend.test.ts`
- `docs/security.md`

## Dependencies on other issues

- None.

## Acceptance criteria

- A failed request's response ID matches its log event.
- Tests verify sensitive input is absent from emitted logs.
- Existing generic client errors remain generic.

## Deliverables

- Correlation middleware/logger and focused redaction tests/documentation.

## How to run tests

- `npm test -- tests/backend.test.ts`
- `npm run typecheck`

## Out of scope

- A hosted observability vendor, tracing SDK, or logging request payloads.

## Suggested labels

- `area: backend`, `area: security`, `type: enhancement`, `difficulty: medium`.
