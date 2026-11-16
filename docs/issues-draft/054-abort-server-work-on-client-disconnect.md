# Abort Server-Side Horizon and Database Work When the Client Disconnects

**Complexity:** high

## Context

Nothing in the request path reacts to a client disconnecting. The verification fetch uses a fixed 10-second timeout independent of the request lifetime in `server/stellar-verification.ts` (function `getJson`, lines 131–134), and no route handler observes `request.on('close')` (confirmed by searching `server/` for request-close listeners, `AbortController`, and `abort`). If a browser navigates away or aborts a slow request to `POST /api/records` (handler at `server/records.ts`, lines 789–868), `POST /api/records/:id/verify` (lines 870–914), or `PUT /api/records/:id` (lines 916–1027), the server continues fetching Horizon pages and holding a pooled client. Affected: server capacity and Horizon request quota under abandoned requests.

## Acceptance criteria

- A new test in `tests/backend.test.ts` stubs `fetch` to resolve only after the client aborts; it asserts the number of Horizon `fetch` calls stops increasing after the abort (asserted call count) and that no `verification_results` row is inserted for the aborted record.
- A normal (non-aborted) `POST /api/records/:id/verify` test still returns 200 and persists a verification row.
- `npm test` and `npm run typecheck` pass.

## Files to touch

- `server/stellar-verification.ts`
- `server/records.ts`
- `server/app.ts` (only if a small middleware is added to attach the controller)
- `tests/` (a test that aborts a request and asserts no further Horizon calls)

## Test expectations

- The fetch-level tests use a stubbed global `fetch`; run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

A global request deadline, retry behavior, or changes to the verification algorithm.

## Depends on

Bound the Total Duration of a Verification Request
