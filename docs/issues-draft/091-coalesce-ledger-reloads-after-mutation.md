# Coalesce the ledger reloads triggered by a single mutation

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 3

## Problem statement

One user action can trigger two full-ledger reloads. Verifying a record runs `loadTransparency()`
and then `refreshRecordAfterAction` (`src/App.tsx:689-690`); updating runs the reverse order
(`src/App.tsx:743-744`). Because `loadTransparency` walks every page (`src/App.tsx:272-281`), the
second call re-downloads data the first call just fetched. Creating and voiding each reload once
(`src/App.tsx:674`, `src/App.tsx:714`), so the cost is visible on every mutation. Affected: users on
slow connections and the API under load.

## Technical implementation requirements

- Make the post-mutation refresh a single load: either update the changed row from the mutation
  response and skip the reload, or drop the redundant call.
- Keep the request-ordering guard (`transparencyRequestId`, `src/App.tsx:253`, `src/App.tsx:260`).
- Do not change what the user sees after a mutation (the row must still reflect the new state).
- Do not add caching that could serve stale rows after a mutation.

## Files and areas to touch

- `src/App.tsx`

## Dependencies

- None. Related to the single-record endpoint draft (which reduces the per-row cost further), but this
  one removes the duplicate whole-ledger load and can land independently.

## Measurable acceptance criteria

- Verifying or updating a record issues exactly one ledger refresh (observable in the network panel),
  and the affected row still shows the updated status/reason.
- Create and void still refresh once.
- `npm run typecheck` and `npm test` pass.

## Expected deliverables

- A single, deduplicated post-mutation refresh path.

## How to set up and run tests

- Run `npm run dev` with an organization wallet, watch the network panel while verifying, editing,
  creating, and voiding a record.

## Out of scope

- Server-side caching, changing when the ledger reloads on filter changes, and the interval-based
  refresh behaviour.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: medium`
