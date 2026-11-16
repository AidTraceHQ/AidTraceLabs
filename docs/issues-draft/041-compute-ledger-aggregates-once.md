# Avoid Recomputing Ledger Aggregates for Every Cursor Page

**Complexity:** high

## Context

Partly overlaps with open issues "Cursor Pagination UI" and "Dashboard Totals". This draft is narrowed to server-side per-page aggregate recompute only; it does not add UI controls or change dashboard total semantics.

Every transparency request runs a grouped amount/status summary and global distinct organization/asset queries before returning one page in `server/records.ts` (lines 693–725). The client fetches multiple pages for one view, so identical aggregate work is repeated for each cursor page. Affected users: public ledger visitors on large datasets who experience slow multi-page loads. Current behavior: summary and facet queries run on every cursor page. Expected behavior: summary/facets are returned on the first page only or through a separately cached query; `getAllPages` retains first-page metadata when combining pages; a measured before/after benchmark on a seeded database is recorded.

## Acceptance criteria

- A multi-page transparency read executes summary/facet queries once per view, not once per page (asserted by query count).
- The combined response still contains the expected summary and facets.
- Filtered summary values and page collection remain correct for empty, one-page, and multi-page results.
- Before/after query count and timing are recorded using synthetic test data only.

## Files to touch

- `server/records.ts`
- `src/api.ts`
- `tests/backend.test.ts`
- `tests/api.test.ts`
- `docs/backend-design.md`

## Test expectations

- Run unit/API tests with `TEST_DATABASE_URL` empty: `npm test -- tests/api.test.ts`
- Run database-backed pagination tests only against the dedicated disposable test database.
- Run: `npm run typecheck`, `npm run lint`

## Out of scope

Replacing cursor pagination, changing totals semantics, or adding a general caching service. UI pagination controls remain in the separate open issue "Cursor Pagination UI".

## Depends on

None
