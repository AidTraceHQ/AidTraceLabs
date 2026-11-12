# Bound Browser API Request Time

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 4

## Problem statement

The shared browser API wrapper calls `fetch` without a deadline or abort signal (`src/api.ts:41-75`). If a request stalls instead of rejecting, login/write busy state and page loading can remain pending indefinitely.

## Technical implementation requirements

- Add a configurable or centrally defined finite deadline to API requests using `AbortSignal.timeout` or an equivalent supported mechanism.
- Convert abort/timeout errors to a clear safe message while preserving `ApiError` status behavior for HTTP responses.
- Permit an explicit per-request timeout override only where a route has a documented longer bound.
- Do not retry mutations automatically.

## Files and areas to touch

- `src/api.ts`
- `tests/api.test.ts`
- `src/App.tsx` only if a timeout-specific user message is needed

## Dependencies

- None. Prior draft #19 covers Horizon account-activity fetches, not the shared `/api` client.

## Measurable acceptance criteria

- A never-resolving mocked fetch rejects within the configured deadline.
- HTTP 409 remains an `ApiError` with status 409; a timeout is not misreported as an HTTP error.
- Timed-out writes are not silently retried.

## Expected deliverables

- Bounded API fetch wrapper, timeout/error tests, and documented default duration.

## How to set up and run tests

- Run `npm test -- tests/api.test.ts`.
- Run `npm run typecheck` and `npm run lint`.

## Out of scope

- Server-side request timeouts, retries, or changes to auth/CSRF behavior.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: medium`.
