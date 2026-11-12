# Let Organizations Set a Display Name

**Publish:** Day 1

**Size:** Medium

## Problem statement

Organization rows are created with a generated wallet-suffix name and have no profile update path, so public records cannot show an organization-chosen name.

## Technical requirements

- Add a minimal organization-profile read/update API for the authenticated organization wallet.
- Validate and normalize the display name, enforce uniqueness, and audit changes.
- Keep wallet ownership and record-ownership checks unchanged.

## Files to touch

- `server/records.ts`
- `migrations/` (only if a constraint or metadata field is needed)
- `src/App.tsx`
- `tests/backend.test.ts`

## Dependencies on other issues

- None.

## Acceptance criteria

- An organization can change only its own display name.
- Duplicate normalized names receive a safe conflict response.
- New and existing aid records render the updated organization display name.
- The change creates an audit event.

## Deliverables

- Profile route/UI, migration if justified, and API authorization/validation tests.

## How to run tests

- `npm test -- tests/backend.test.ts`
- `npm run typecheck`

## Out of scope

- Organization discovery, logos, contact data, or beneficiary acknowledgment.

## Suggested labels

- `area: backend`, `area: frontend`, `type: enhancement`, `difficulty: medium`.
