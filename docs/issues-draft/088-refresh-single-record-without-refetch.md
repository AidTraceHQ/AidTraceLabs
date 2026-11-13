# Add a single-record endpoint and stop refetching the ledger to refresh one row

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 12 hours

**Release day:** Day 1

## Problem statement

Refreshing a single record re-downloads the whole ledger. `getLatestRecord` calls
`api.getAllPages('/api/transparency?q=<id>')` and then searches the returned pages
(`src/App.tsx:288-301`); the verify and update paths follow the same pattern (`src/App.tsx:689-690`, inside
`verifyRecord`, and `src/App.tsx:743-744`, inside `editRecord`). `getAllPages` walks the entire cursor chain
(`src/api.ts:83-119`), so a one-row refresh costs one request per page of matches. There is no
single-record route in the documented API (`docs/api.md:5-22`). Affected: any user verifying or
editing a record while the ledger is large, and the public ledger after a write.

## Technical implementation requirements

- Add an authenticated `GET /api/records/:id` in `server/records.ts` that returns exactly one record.
- Apply the **same projection rules** as `/api/transparency` (consent-off pseudonymisation and field
  withholding) so the new route cannot leak fields the list route hides. Reuse the existing
  projection helpers rather than writing a new query.
- Return `404 { "error": "Record not found." }` for unknown ids, and keep the existing session/CSRF
  rules (read routes require no CSRF token).
- Update `getLatestRecord` and `refreshRecordAfterAction` (`src/App.tsx:288-305`) to use the new route.
- Do not change authorization beyond "authenticated", and do not alter existing list behaviour.

## Files and areas to touch

- `server/records.ts`
- `src/App.tsx`
- `src/api.ts` (typed helper for the new route)
- `docs/api.md` (one row for the new endpoint)
- `tests/backend.test.ts`

## Dependencies

- None. Distinct from the ledger total-count and server-sort drafts, which change list semantics.

## Measurable acceptance criteria

- `GET /api/records/:id` returns the record for a valid id and `404 { "error": "Record not found." }` for an
  unknown id.
- For a consent-off record, the new route returns a body equal to the `/api/transparency` row for the same id
  (same withheld fields); the test asserts no direct identifiers appear when the list route withholds them.
- A verify/edit issues one `GET /api/records/:id` request instead of `getAllPages` walking the cursor chain
  (observable in the network panel: one request, not one per page).
- `npm test -- tests/backend.test.ts` and `npm run typecheck` exit 0.

## Expected deliverables

- A single-record endpoint with projection parity, client wiring, an API doc row, and integration
  tests.

## How to set up and run tests

- Configure the guarded test database (`TEST_DATABASE_URL`, `TEST_DATABASE_BRANCH=test`) and run
  `npm test -- tests/backend.test.ts`.
- Run `npm run dev` and verify a record from the ledger while watching the network panel.

## Out of scope

- Changing list pagination or totals, adding field-level access changes, and any UI redesign beyond
  the fetch swap.

## Suggested labels

- `area: backend`, `area: frontend`, `type: enhancement`, `difficulty: high`
