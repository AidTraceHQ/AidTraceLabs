# Let Organizations Set a Display Name

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 1

## Problem statement

Organization rows are created with a generated wallet-suffix name and have no profile update path, so public records cannot show an organization-chosen name.

## Technical implementation requirements

- Add a minimal organization-profile read/update API for the authenticated organization wallet.
- Validate and normalize the display name, enforce uniqueness, and audit changes.
- Keep wallet ownership and record-ownership checks unchanged.

## Files and areas to touch

- `server/records.ts`
- `migrations/` (only if a constraint or metadata field is needed)
- `src/App.tsx`
- `tests/backend.test.ts`

## Dependencies

- None.

## Measurable acceptance criteria

- A request authenticated as organization A that targets organization B's profile returns `403` and writes nothing.
- Submitting a display name that normalizes to an existing organization's name returns `409` and performs no write.
- A record fetch after a display-name change renders the updated organization name for both pre-existing and newly created aid records.
- The successful update inserts exactly one audit event.
- `npm test -- tests/backend.test.ts` passes.

## Expected deliverables

- Profile route/UI, migration if justified, and API authorization/validation tests.

## How to set up and run tests

- `npm test -- tests/backend.test.ts`
- `npm run typecheck`

## Out of scope

- Organization discovery, logos, contact data, or beneficiary acknowledgment.

## Suggested labels

- `area: backend`, `area: frontend`, `type: enhancement`, `difficulty: medium`.
