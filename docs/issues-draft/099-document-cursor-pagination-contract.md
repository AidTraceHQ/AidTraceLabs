# Document the cursor pagination contract and its limits

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 5

## Problem statement

`docs/api.md:24` states that list routes use signed cursors bound to their filters, but the document
never explains the response envelope, the default and maximum page size, what a client should do with
an opaque cursor, or what happens when a cursor is stale, tampered with, or replayed under different
filters. These rules live only in `server/records.ts` (`readPage`/`sendPage`) and the tests. A
contributor building a paged view cannot implement it from the docs alone. Affected: API consumers
and anyone extending the ledger UI.

## Technical implementation requirements

- Document the list response envelope fields exactly as returned (records array, next/prev cursor,
  and any total field once the totals draft lands).
- Document the `limit` default, the accepted range, and the behaviour when an out-of-range value is
  supplied.
- Document cursor semantics: opaque to clients, single-use per filter binding, and the response when
  a cursor is invalid/expired/mismatched.
- Provide one short request → response example per list route category (transparency, roles, audit)
  without duplicating the full examples planned elsewhere.
- Do not change the cursor implementation, signing, or page-size limits.

## Files and areas to touch

- `docs/api.md`

## Dependencies

- If the "return a bounded total" draft lands first, document the new envelope field here. Otherwise
  document the current envelope and leave a clear placeholder-free description of what exists now.

## Measurable acceptance criteria

- The pagination section names every envelope field, the `limit` rules, and the invalid-cursor
  behaviour, each traceable to `server/records.ts`.
- At least one concrete request and response example is included.
- `npm run format:check` passes.

## Expected deliverables

- A pagination-contract section in `docs/api.md`.

## How to set up and run tests

- Exercise `GET /api/transparency?limit=2` and a follow-up request with the returned cursor to confirm
  the documented shape.
- Run `npm run format:check`.

## Out of scope

- Changing pagination behaviour, adding a new cursor format, and client-side paging UI (existing GitHub issue #22).

## Suggested labels

- `area: docs`, `type: documentation`, `difficulty: medium`
