# Align filtered record pagination with an ordering index

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 3

## Problem statement

Every record list orders by `created_at DESC, id DESC`: `listRows` always appends that ordering
(`server/records.ts:449-455`) and `transparencyHandler` calls it with `'r.created_at'` and `'r.id'`
(`server/records.ts:712-719`, the `listRows<RecordRow>` call). The index intended for network/status filters is
`aid_records_network_status_date_idx(network, status, disbursement_date, id)`
(`migrations/001_initial_schema.sql:75`), which has no `created_at` column, and the two `created_at`
indexes (`migrations/001_initial_schema.sql:72-74`) are keyed on `created_at`/`organization_wallet`/
`recipient_wallet` only. A request such as `GET /api/transparency?network=testnet&status=verified` can use
the composite index for filtering but must then sort the matched rows in memory for every page, which
degrades as the table grows. Affected: public and beneficiary record listings with filters.

## Technical implementation requirements

- Add forward-only index(es) that support the filtered ordering, for example
  `aid_records (network, status, created_at DESC, id DESC)` and/or
  `aid_records (network, disbursement_date, created_at DESC, id DESC)`.
- Keep the existing indexes unless a measured plan shows one is fully redundant; do not drop an index purely
  on inspection.
- Do not change filters, the query builder, the cursor envelope, or response semantics.
- Capture an `EXPLAIN` (ANALYZE) plan on a seeded disposable database for the filtered list query before and
  after, and record it in the deliverables.

## Files and areas to touch

- `migrations/004_record_pagination_indexes.sql` (next free number)
- `tests/backend.test.ts`
- `docs/backend-design.md`

## Dependencies

- None. Distinct from the aggregate-recompute draft, which changes summary query frequency rather than the
  list index.

## Measurable acceptance criteria

- A committed `EXPLAIN (ANALYZE)` capture for the filtered list query shows the plan no longer contains a
  `Sort` node above an `Index Scan`/`Index Only Scan` on the new index (or documents the measured before/after
  plan improvement).
- Page contents, ordering, `hasMore`, and cursor behaviour are unchanged; the pagination assertions in
  `tests/backend.test.ts` pass unchanged.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` exit 0.

## Expected deliverables

- Pagination index migration, before/after `EXPLAIN` evidence from a seeded test database, and an updated
  index list in `docs/backend-design.md`.

## How to set up and run tests

- Configure the disposable `TEST_DATABASE_URL` described in `CONTRIBUTING.md`, then `npm run db:migrate`,
  `npm test -- tests/backend.test.ts`, and `npm run typecheck`.

## Out of scope

- Rewriting `listRows`, changing the cursor format, or caching aggregates.

## Suggested labels

- `area: data`, `type: enhancement`, `difficulty: medium`
