# Add an admin audit-log CSV export

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 12 hours

**Release day:** Day 2

## Problem statement

Administrators can filter and page audit events in the UI, and the events are served by
`GET /api/audit` (documented at `docs/api.md:22`), but there is no way to export them. Reviewers,
auditors, and grant reporting need the security trail in a file, not just on screen. Neighbouring
work does not cover this: existing GitHub issue #12 is CSV **test coverage** for the records export,
existing GitHub issue #14 is a per-record receipt export, and existing GitHub issue #16 is dashboard
totals. A separate audit export is a genuine missing capability.

## Technical implementation requirements

- Export the currently filtered audit events as CSV, honouring the same filters the audit view
  already applies (`action`, `address`, `recordId`, `q` — `docs/api.md:24`).
- Enforce admin authorization for the whole export: the export must never return rows to a
  non-admin, and the client must not be the only guard.
- Because the audit list is cursor-paged, page through the filtered set within a bounded loop with an
  explicit cap, and surface a clear message if the cap is reached instead of silently truncating.
- Columns: `created_at`, `action`, `actor`, `subject`, `record_id`, `summary`, and any safe metadata
  already returned to the audit view. Do **not** export anything the audit view does not already
  return.
- Reuse the CSV escaping agreed for the records export (including formula-injection neutralisation).

## Files and areas to touch

- `src/App.tsx` (admin audit section)
- `server/records.ts` (only if a bounded admin export path is added)
- `docs/api.md`
- `tests/backend.test.ts` (authorization) and `tests/csv.test.ts` (formatting)

## Dependencies

- The formula-injection guard draft should land first or together so the shared escaper is safe.

## Measurable acceptance criteria

- An admin can export the filtered audit events; the file contains exactly the filtered rows.
- A non-admin request/route for the same data returns `403`/`404` and never CSV data.
- When the result exceeds the cap, the UI reports that the export was truncated.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.

## Expected deliverables

- An authorized audit-log CSV export (client, optional bounded server path), docs, and tests.

## How to set up and run tests

- Configure the guarded test database and run `npm test -- tests/backend.test.ts`.
- Run `npm run dev` as an admin, apply audit filters, export, and compare the file with the on-screen
  rows; then retry as a non-admin and confirm denial.

## Out of scope

- Changing audit filtering, adding new audit fields, scheduled exports, and external log shipping.

## Suggested labels

- `area: frontend`, `area: security`, `type: enhancement`, `difficulty: high`
