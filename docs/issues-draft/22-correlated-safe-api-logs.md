# Add Correlated, Redacted API Error Logs

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 3

## Problem statement

Unexpected API errors are logged without a request ID or structured safe fields, making hosted failures difficult to correlate while risking overly broad error serialization.

## Technical implementation requirements

- Assign or validate a request ID, return it in a response header, and include it in structured error logs.
- Log only method, route template, status, request ID, and a safe error category.
- Never log request bodies, cookies, signatures, tokens, full URLs with query strings, or database connection details.

## Files and areas to touch

- `server/app.ts`
- `server/http-security.ts` or a new request-context middleware
- `tests/backend.test.ts`
- `docs/security.md`

## Dependencies

- None.

## Measurable acceptance criteria

- A test triggers a failed request and asserts the request ID in the response header equals the request ID in the emitted structured log event.
- A test asserts emitted log output contains no request bodies, cookies, signatures, tokens, or query strings.
- A test asserts existing generic client error responses remain unchanged.
- `npm test -- tests/backend.test.ts` passes.

## Expected deliverables

- Correlation middleware/logger and focused redaction tests/documentation.

## How to set up and run tests

- `npm test -- tests/backend.test.ts`
- `npm run typecheck`

## Out of scope

- A hosted observability vendor, tracing SDK, or logging request payloads.

## Suggested labels

- `area: backend`, `area: security`, `type: enhancement`, `difficulty: medium`.
