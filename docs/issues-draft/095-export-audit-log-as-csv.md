# Add an Admin Audit-Log CSV Export

**Complexity:** advanced

## Context

Administrators can filter and page audit events in the UI via `GET /api/audit` (documented in `docs/api.md`, line 22), but there is no way to export them. Reviewers, auditors, and grant reporting teams need the security trail in a file. Affected: admin users who need an exportable record of audit events for compliance or reporting. Current behavior: no export is available from the audit view. Expected behavior: a bounded export of the currently filtered audit events is available to admin users only, enforced both server-side and client-side. Because the audit list is cursor-paged, the export loops through the filtered set with an explicit cap and surfaces a clear message if the cap is reached instead of silently truncating. Must reuse the CSV escaping agreed for the records export (including formula-injection neutralization).

## Acceptance criteria

- An admin can export the filtered audit events; the file contains exactly the filtered rows.
- A non-admin request or route for the same data returns `403`/`404` and never CSV data.
- When the result exceeds the cap, the UI reports that the export was truncated.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.

## Files to touch

- `src/App.tsx` (admin audit section)
- `server/records.ts` (only if a bounded admin export path is added)
- `docs/api.md`
- `tests/backend.test.ts` (authorization)
- `tests/csv.test.ts` (formatting)

## Test expectations

- Configure: `TEST_DATABASE_URL`, `TEST_DATABASE_BRANCH=test`
- Run: `npm test -- tests/backend.test.ts`
- Manual: run `npm run dev` as an admin, apply audit filters, export, and compare the file with the on-screen rows; then retry as a non-admin and confirm denial.

## Out of scope

Changing audit filtering, adding new audit fields, scheduled exports, and external log shipping.

## Depends on

Guard the CSV export against spreadsheet formula injection
