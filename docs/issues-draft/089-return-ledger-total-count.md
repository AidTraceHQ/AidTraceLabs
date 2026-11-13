<!-- OVERLAP: Partly overlaps with open issue #22 "Cursor Pagination UI". Provides the server-side total count primitive that #22 depends on. Narrowed to envelope field and footer rendering only; no UI pagination controls. -->

# Return a bounded total so the ledger can page without loading every record

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 14 hours

**Release day:** Day 1

## Problem statement

The ledger loads **every** matching record before it can render. The client calls
`api.getAllPages('/api/transparency?...')` (`src/App.tsx:272-281`), which loops the signed cursor
until exhaustion (`src/api.ts:83-119`), because `pageCount`, the `Sort`/filter application, and the
`Showing A–B of C` footer are all computed in the browser (`src/App.tsx:790-861`,
`src/App.tsx:1291-1315`). First paint and every reload therefore scale with the whole table, not with
the page size, even though the server already paginates with signed cursors (`docs/api.md:24`). The
server cursor envelope (`server/records.ts` `readPage`/`sendPage`) does not expose a total. Affected:
public ledger performance as the dataset grows.

## Technical implementation requirements

- Add a bounded `total` (and/or an explicit `hasMore`) to the records list envelope returned by
  `sendPage`, computed with the same filters that bind the cursor.
- Keep cursor semantics and signed-cursor binding unchanged; a cursor must remain valid only for the
  filters it was issued under.
- Render the footer (`src/App.tsx:1291-1315`) from the server total instead of the loaded array
  length.
- Do not remove the public projection rules or the existing filter parameters.
- Do not change the response shape in a way that breaks existing consumers: add fields, do not
  rename them.

## Files and areas to touch

- `server/records.ts`
- `src/App.tsx`
- `src/api.ts`
- `docs/api.md` (envelope fields)
- `tests/backend.test.ts`

## Dependencies

- None. Adjacent to existing GitHub issue #22 (cursor pagination **UI**) and to the server-sort draft, but
  this adds the count primitive those depend on without implementing either.

## Measurable acceptance criteria

- A `GET /api/transparency?limit=N` response includes a correct total for the bound filters, verified
  against a known seeded row count.
- The footer renders the correct "of C" figure after loading a single page.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.
- A request for page 1 no longer walks the cursor chain when the client uses the new field.

## Expected deliverables

- Total/hasMore in the list envelope, a client that uses it, envelope docs, and tests.

## How to set up and run tests

- Configure the guarded test database and run `npm test -- tests/backend.test.ts`.
- Run `npm run dev` and confirm the ledger footer shows the server total with a single request in the
  network panel.

## Out of scope

- Cursor pagination UI controls (existing GitHub issue #22), server-side sort (separate draft), and any change to the
  signing algorithm for cursors.

## Suggested labels

- `area: backend`, `area: frontend`, `type: enhancement`, `difficulty: high`
