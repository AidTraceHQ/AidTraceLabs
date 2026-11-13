# Bound the Total Duration of a Verification Request

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 1

## Problem statement

`checkTransaction` fetches the transaction and then reads operations in up to 20 pages (`server/stellar-verification.ts:38-39`, the `operationPageSize`/`operationPageLimit` constants), each issued by `getJson` with its own independent 10-second abort (`server/stellar-verification.ts:131-134`), inside the operations loop at `server/stellar-verification.ts:228-278`. There is no overall time budget, so the verification work behind the `POST /api/records/:id/verify` handler (`server/records.ts:870-914`), the verification block in the `POST /api/records` handler (`server/records.ts:848-864`), and the verification block in the `PUT /api/records/:id` handler (`server/records.ts:1007-1023`) can occupy a handler for roughly 200 seconds or more. That exceeds typical reverse-proxy and serverless function limits and holds a request slot for the whole time. Affected: clients and any deployment with a proxy or function timeout.

## Technical implementation requirements

- Introduce a single overall deadline for one verification run and stop issuing Horizon requests once it elapses.
- When the deadline is reached, return the existing `pending` verification status with a clear `reason`, so the caller persists a retryable result.
- Pass the deadline (or an `AbortSignal`) into `getJson` so each request's timeout is the smaller of the 10-second default and the remaining budget.
- Keep the 10-second per-request timeout, the matching algorithm, and the 20-page operation bound unchanged.
- Do NOT change response shapes, status semantics, or the `pending` reason contract; a timed-out run must persist the same shape as an unavailable Horizon.

## Files and areas to touch

- `server/stellar-verification.ts`
- `server/records.ts` (only if a route-level deadline needs to be threaded through)
- `tests/backend.test.ts`

## Dependencies

- Blocks "Bound Horizon Verification With Bounded Retries and a Total Deadline", which adds bounded Horizon retries that must reuse this deadline rather than introduce their own. Related to, but distinct from, the Horizon failure-contract test draft: this changes runtime behaviour, not only coverage. Do not overlap the multi-operation coverage in open GitHub issue #17.

## Measurable acceptance criteria

- A new test in `tests/backend.test.ts` (for example `it('returns pending before the overall verification deadline')`) stubs `fetch` so each operations page resolves after the deadline; the call returns `status: 'pending'` with a `reason`, and the measured elapsed time is asserted to be below the configured deadline.
- The existing tests in `tests/backend.test.ts` ('requires one operation to match the organization source and all payment fields', 'handles strict-send destination fields, missing hashes and not-found transactions') still observe `verified`, `mismatch`, and `not-found`.
- `npm test -- tests/backend.test.ts` passes and `npm run typecheck` passes.

## Expected deliverables

- A configurable overall verification deadline threaded through the Horizon fetch loop, plus deadline-boundary tests.

## How to set up and run tests

- The verification tests use a stubbed global `fetch`; run `npm test -- tests/backend.test.ts` (a database is only needed if the record-writing routes are exercised).
- Run `npm run typecheck`.

## Out of scope

- Changing the matching algorithm, adding retries, scheduled re-verification, or altering the 20-page bound.

## Suggested labels

- `area: backend`, `type: enhancement`, `difficulty: medium`
