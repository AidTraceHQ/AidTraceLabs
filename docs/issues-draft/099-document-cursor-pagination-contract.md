# Document the Cursor Pagination Contract and Its Limits

**Complexity:** intermediate

## Context

`docs/api.md` (line 24) states that list routes use signed cursors bound to their filters, but the document never explains the response envelope, the default and maximum page size, what a client should do with an opaque cursor, or what happens when a cursor is stale, tampered with, or replayed under different filters. These rules live only in `server/records.ts` (functions `readPage`/`sendPage`) and the tests. A contributor building a paged view cannot implement it from the docs alone. Affected: API consumers and anyone extending the ledger UI.

## Acceptance criteria

- The pagination section names every envelope field, the `limit` rules, and the invalid-cursor behavior, each traceable to `server/records.ts`.
- At least one concrete request and response example is included.
- `npm run format:check` passes.

## Files to touch

- `docs/api.md`

## Test expectations

- Exercise `GET /api/transparency?limit=2` and a follow-up request with the returned cursor to confirm the documented shape.
- Run: `npm run format:check`
- No application code change.

## Out of scope

Changing pagination behavior, adding a new cursor format, and client-side paging UI (tracked by a separate open issue).

## Depends on

Return a bounded total so the ledger can page without loading every record
