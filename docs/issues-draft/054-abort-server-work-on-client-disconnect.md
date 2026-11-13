# Abort Server-Side Horizon and Database Work When the Client Disconnects

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 10 hours

**Release day:** Day 2

## Problem statement

Nothing in the request path reacts to a client disconnecting. The verification fetch uses a fixed 10-second timeout that is independent of the request lifetime (`server/stellar-verification.ts:131-134`, the `getJson` helper's `fetch` with `AbortSignal.timeout(10_000)`), and no route handler observes `request.on('close')` (confirmed by searching `server/` for request-close listeners, `AbortController`, and `abort`). If a browser navigates away or aborts a slow request to the `POST /api/records` handler (`server/records.ts:789-868`), the `POST /api/records/:id/verify` handler (`server/records.ts:870-914`), or the `PUT /api/records/:id` handler (`server/records.ts:916-1027`), the server continues fetching Horizon pages and holding a pooled client until it finishes. Affected: server capacity and Horizon request quota under abandoned requests.

## Technical implementation requirements

- Create an `AbortController` per request, abort it when the client disconnects before the response completes, and pass its signal into the Horizon fetch path so in-flight `fetch` calls are cancelled.
- Treat an aborted run like an unavailable Horizon: do not write a partial verification result, and persist the existing `pending` shape if any write occurs.
- The close listener must be a no-op once the response has been sent, so normal completion is never affected.
- Do NOT change status codes or response shapes; a disconnected client receives nothing.
- Do NOT abort unrelated background work or long-lived connections (for example, keep-alive sockets between requests).

## Files and areas to touch

- `server/stellar-verification.ts`
- `server/records.ts`
- `server/app.ts` (only if a small middleware is added to attach the controller)
- `tests/` (a test that aborts a request and asserts no further Horizon calls)

## Dependencies

- Related to the verification-deadline draft (051), which applies a fixed budget rather than early cancellation. Keep the two changes independent.

## Measurable acceptance criteria

- A new test in `tests/backend.test.ts` stubs `fetch` to resolve only after the client aborts the request; it asserts the number of Horizon `fetch` calls stops increasing after the abort (asserted call count) and that no `verification_results` row is inserted for the aborted record.
- A normal (non-aborted) `POST /api/records/:id/verify` test still returns 200 and persists a verification row.
- `npm test` and `npm run typecheck` pass.

## Expected deliverables

- Per-request cancellation wired from the socket to the Horizon fetch path, plus disconnect tests.

## How to set up and run tests

- The fetch-level tests use a stubbed global `fetch`; run `npm test -- tests/backend.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- A global request deadline, retry behavior, or changes to the verification algorithm.

## Suggested labels

- `area: backend`, `type: enhancement`, `difficulty: high`
