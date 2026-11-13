# Bound Horizon Verification With Bounded Retries and a Total Deadline

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 12 hours

**Release day:** Day 2

## Problem statement

`getJson` performs exactly one GET with a per-request 10-second abort and no retry (`server/stellar-verification.ts:130-141`), so a single transient transport error immediately becomes `pending` (`server/stellar-verification.ts:176-187`), and the same helper is called inside a loop that can issue up to twenty sequential operation GETs (`server/stellar-verification.ts:228-278`). The worst case is therefore roughly twenty times ten seconds of wall time for one `/verify` request (`server/records.ts:870-914`), which can exceed serverless or edge timeouts while still returning a generic `pending`. Affected: organizations on flaky networks who must retry manually, and operators whose functions can time out on operation-heavy transactions.

## Technical implementation requirements

- Add a small, bounded retry (for example up to two retries with capped exponential backoff and jitter) only for clearly transient failures: network/timeout errors and `429`/`5xx` responses. Never retry a `404` and never retry a successful response; all calls are read-only GETs.
- Reuse the single overall deadline introduced by "Bound the Total Duration of a Verification Request": thread that existing deadline (or its `AbortSignal`) into every `getJson` call so retries never extend past the one shared budget; when the deadline is exceeded, return `pending` with a clear reason. Do not add a second, competing deadline mechanism.
- Preserve the existing status mapping and user-safe reasons; any exhausted or over-deadline read stays `pending`.
- Do NOT change the matching algorithm, statuses, or rate limits, and do not add a dependency.
- Document the retry and deadline policy in `docs/backend-design.md`.

## Files and areas to touch

- `server/stellar-verification.ts`
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Dependencies

- Depends on "Bound the Total Duration of a Verification Request", which supplies the aggregate verification deadline this issue reuses; this issue adds only the bounded-retry policy and must not re-implement the deadline. Boundary with "Lock Down Horizon Failure-State Contracts": "Lock Down Horizon Failure-State Contracts" adds a _test_ matrix locking the current failure-state contract; this issue changes the request _policy_ (bounded retries over the shared deadline) and adds its own tests. Neither changes the other's deliverable.

## Measurable acceptance criteria

- A transaction GET that throws once is retried and can still reach `verified` or `mismatch`.
- A persistent failure exhausts the bounded retries and returns `pending` with the existing safe reason, and the attempt count is bounded and asserted.
- A slow operation endpoint cannot consume more than the overall deadline; the pass returns `pending` before exhausting the page loop.
- A `404` transaction response is never retried.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.

## Expected deliverables

- A deadline-aware, bounded-retry `getJson`/pass, plus mocked tests proving retry bounds, deadline enforcement, and unchanged failure mapping.

## How to set up and run tests

- To skip database integration locally, set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty in the shell, then run `npm test -- tests/backend.test.ts`; the Horizon tests use a mocked `fetch`.
- Run `npm run typecheck`.

## Out of scope

- Changing eligible operation types or matching fields, altering rate limits, or adding a background/scheduled verifier (existing GitHub issue #18).

## Suggested labels

- `area: backend`, `type: enhancement`, `difficulty: high`.
