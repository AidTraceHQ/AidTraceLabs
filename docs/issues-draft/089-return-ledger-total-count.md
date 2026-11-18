# Return a Bounded Total So the Ledger Can Page Without Loading Every Record

**Complexity:** advanced

## Context

> **Overlap note:** Server-side total count is a prerequisite for open issue "Cursor Pagination UI"; partly overlaps scope. Narrowed: adds `total` envelope field and replaces `getAllPages` on first load; no UI pagination controls.

The ledger loads every matching record before it can render. The client calls `api.getAllPages('/api/transparency?...')` in `src/App.tsx` (lines 272Ã¢â‚¬â€œ281), which loops the signed cursor until exhaustion in `src/api.ts` (lines 83Ã¢â‚¬â€œ119), because `pageCount`, sort/filter application, and the `Showing AÃ¢â‚¬â€œB of C` footer are all computed in the browser (lines 790Ã¢â‚¬â€œ861 and 1291Ã¢â‚¬â€œ1315). First paint and every reload therefore scale with the whole table, not with the page size, even though the server already paginates with signed cursors. The server cursor envelope (`readPage`/`sendPage` in `server/records.ts`) does not expose a total. Affected: public ledger performance as the dataset grows.

## Acceptance criteria

- A `GET /api/transparency?limit=N` response includes a correct `total` for the bound filters, verified against a known seeded row count.
- The footer renders the correct "of C" figure after loading a single page.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.
- A request for page 1 no longer walks the cursor chain when the client uses the new field.

## Files to touch

- `server/records.ts`
- `src/App.tsx`
- `src/api.ts`
- `docs/api.md` (envelope fields)
- `tests/backend.test.ts`

## Test expectations

- Configure: `TEST_DATABASE_URL`, `TEST_DATABASE_BRANCH=test`
- Run: `npm test -- tests/backend.test.ts`
- Manual: run `npm run dev` and confirm the ledger footer shows the server total with a single request in the network panel.

## Out of scope

Cursor pagination UI controls (tracked by the separate open issue "Cursor Pagination UI"), server-side sort (separate draft), and any change to the signing algorithm for cursors.

## Depends on

None
