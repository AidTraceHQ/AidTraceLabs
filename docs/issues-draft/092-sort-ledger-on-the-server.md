<!-- OVERLAP: Partly overlaps with open issue #22 "Cursor Pagination UI". Narrowed to server-side sort parameter and cursor-binding; UI pagination controls remain in #22. -->

# Sort the ledger on the server and bind cursors to the sort

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 14 hours

**Release day:** Day 2

## Problem statement

Sorting is performed in the browser over the fully loaded dataset (`src/App.tsx:804-820`, header
buttons at `src/App.tsx:878-884`) rather than by the database. This only works because the client
currently fetches every record; it cannot be correct once paging is bounded, because a browser can
only sort the rows it happens to hold. The list route already paginates with signed cursors bound to
the query filters (`docs/api.md:24`) but exposes no sort parameter, so the current design couples
"sort works" to "load everything". Affected: the long-term scalability of the public ledger.

## Technical implementation requirements

- Accept `sort` (and direction) on the transparency list route and apply it in SQL with a
  deterministic tiebreaker (e.g. `date DESC, id DESC`) so paging is stable.
- **Bind the signed cursor to the sort** so a cursor issued under one ordering cannot be replayed
  under another; extend the existing cursor payload rather than adding a parallel mechanism.
- Validate the allowed sort fields against an allow-list; reject anything else with `400`.
- Update the client header buttons to request a server-side sort instead of re-sorting in memory.
- Do not weaken the cursor signature (HMAC) or the public projection rules.

## Files and areas to touch

- `server/records.ts`
- `src/App.tsx`
- `docs/api.md`
- `tests/backend.test.ts`
- `tests/` (a cursor/sort binding test)

## Dependencies

- Best implemented after (or alongside) the "return a bounded total" draft, which changes the same
  envelope; if landed first, it must still keep the envelope backward-compatible.

## Measurable acceptance criteria

- `GET /api/transparency?sort=amount&direction=desc&limit=N` returns rows in the requested order with
  a stable tiebreaker across pages.
- A cursor issued for `sort=date` is rejected when replayed with `sort=amount`.
- An unknown `sort` value returns `400`.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.

## Expected deliverables

- Server-side ordering with sort-bound cursors, client wiring, docs, and tests.

## How to set up and run tests

- Configure the guarded test database and run `npm test -- tests/backend.test.ts`.
- Run `npm run dev` and confirm the ledger sort headers reorder rows correctly across pages.

## Out of scope

- Cursor pagination UI controls (existing GitHub issue #22), multi-column sort, saved sort preferences, and full-text
  ranking.

## Suggested labels

- `area: backend`, `area: frontend`, `type: enhancement`, `difficulty: high`
