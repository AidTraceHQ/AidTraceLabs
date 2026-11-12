# Avoid Recomputing Ledger Aggregates for Every Cursor Page

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 16 hours

**Release day:** Day 2

## Problem statement

Every transparency request runs a grouped amount/status summary and global distinct organization/asset queries before returning one page (`server/records.ts:693-725`). The client fetches multiple pages for one view, so identical aggregate work is repeated for each cursor page.

## Technical implementation requirements

- Return summary/facets on the first page only or through a separately cached query, while preserving the public response contract for consumers.
- Update `getAllPages` to retain first-page metadata when it combines collection pages; do not make filters disappear after the final page.
- Measure query counts and representative latency on a seeded disposable database before/after.
- Do not introduce a cache whose invalidation can leave totals stale beyond a documented bound.

## Files and areas to touch

- `server/records.ts`
- `src/api.ts`
- `tests/backend.test.ts`
- `tests/api.test.ts`
- `docs/backend-design.md`

## Dependencies

- None. #22 is about progressive UI pagination; this is repeated server aggregate work.

## Measurable acceptance criteria

- A multi-page transparency read executes summary/facet queries once per view, not once per page.
- Combined response still contains the expected summary and facets.
- Filtered summary values and page collection remain correct for empty, one-page, and multi-page results.
- Before/after query count and timing are recorded using synthetic test data only.

## Expected deliverables

- Aggregate query lifecycle change, response-composition tests, and a short benchmark note.

## How to set up and run tests

- Run unit/API tests with `TEST_DATABASE_URL` empty: `npm test -- tests/api.test.ts`.
- Run database-backed pagination tests only against the dedicated disposable test database.
- Run `npm run typecheck` and `npm run lint`.

## Out of scope

- Replacing cursor pagination, changing totals semantics, or adding a general caching service.

## Suggested labels

- `area: backend`, `area: infrastructure`, `type: enhancement`, `difficulty: high`.
