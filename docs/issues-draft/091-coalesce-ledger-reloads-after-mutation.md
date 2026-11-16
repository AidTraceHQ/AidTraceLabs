# Coalesce the Ledger Reloads Triggered by a Single Mutation

**Complexity:** medium

## Context

One user action can trigger two full-ledger reloads in `src/App.tsx`. Verifying a record runs `loadTransparency()` and then `refreshRecordAfterAction` (lines 689–690); updating runs the reverse order (lines 743–744). Because `loadTransparency` walks every page (lines 272–281), the second call re-downloads data the first call just fetched. Creating and voiding each reload once (lines 674 and 714). Affected: users on slow connections and the API under load. Current behavior: verify and update each trigger two full-ledger reloads. Expected behavior: each mutation produces exactly one ledger reload.

## Acceptance criteria

- Verifying or updating a record issues exactly one ledger refresh (observable in the network panel), and the affected row still shows the updated status/reason.
- Create and void still refresh once.
- The request-ordering guard (`transparencyRequestId`, lines 253 and 260) is preserved.
- `npm run typecheck` and `npm test` pass.

## Files to touch

- `src/App.tsx`

## Test expectations

- Manual: run `npm run dev` with an organization wallet, watch the network panel while verifying, editing, creating, and voiding a record.
- Run: `npm run typecheck`
- Run: `npm test`

## Out of scope

Server-side caching, changing when the ledger reloads on filter changes, and the interval-based refresh behavior.

## Depends on

None
