# Align Filtered Record Pagination with an Ordering Index

**Complexity:** medium

## Context

Every record list orders by `created_at DESC, id DESC`: `listRows` appends that ordering in `server/records.ts` (lines 449–455) and `transparencyHandler` calls it with `'r.created_at'` and `'r.id'` (the `listRows<RecordRow>` call at lines 712–719). The index intended for network/status filters is `aid_records_network_status_date_idx(network, status, disbursement_date, id)` in `migrations/001_initial_schema.sql` (line 75), which has no `created_at` column. A request such as `GET /api/transparency?network=testnet&status=verified` can use the composite index for filtering but must sort the matched rows in memory for every page, which degrades as the table grows. Affected: public and beneficiary record listings with filters.

## Acceptance criteria

- A committed `EXPLAIN (ANALYZE)` capture for the filtered list query shows the plan no longer contains a `Sort` node above an `Index Scan`/`Index Only Scan` on the new index (or documents the measured before/after plan improvement).
- Page contents, ordering, `hasMore`, and cursor behavior are unchanged; the pagination assertions in `tests/backend.test.ts` pass unchanged.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` exit 0.

## Files to touch

- `migrations/004_record_pagination_indexes.sql` (next free number; confirm at implementation time)
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Test expectations

- Configure: disposable `TEST_DATABASE_URL` (see `CONTRIBUTING.md`)
- Run: `npm run db:migrate`
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Rewriting `listRows`, changing the cursor format, or caching aggregates.

## Depends on

None
