# Bound Browser API Request Time

**Complexity:** medium

## Context

The shared browser API wrapper in `src/api.ts` (lines 41–75) calls `fetch` without a deadline or abort signal. If a request stalls instead of rejecting, login/write busy state and page loading can remain pending indefinitely. Affected users: all users of the application on slow or unreliable connections. Current behavior: API requests have no timeout; a stalled request leaves the UI in a pending state forever. Expected behavior: a configurable finite deadline is applied to API requests using `AbortSignal.timeout` or equivalent; abort/timeout errors are converted to a clear safe message while preserving `ApiError` status behavior for HTTP responses; mutations are not retried automatically.

## Acceptance criteria

- A never-resolving mocked fetch rejects within the configured deadline.
- HTTP 409 remains an `ApiError` with status 409; a timeout is not misreported as an HTTP error.
- Timed-out writes are not silently retried.

## Files to touch

- `src/api.ts`
- `tests/api.test.ts`
- `src/App.tsx` (only if a timeout-specific user message is needed)

## Test expectations

- Run: `npm test -- tests/api.test.ts`
- Run: `npm run typecheck`
- Run: `npm run lint`
- No database required.

## Out of scope

Server-side request timeouts, retries, or changes to auth/CSRF behavior. Activity-request lifecycle is tracked by "Bound the Account Activity Request Lifecycle".

## Depends on

None
