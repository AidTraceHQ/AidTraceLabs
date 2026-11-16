# Let Organizations Set a Display Name

**Complexity:** medium

## Context

Organization rows are created with a generated wallet-suffix name and have no profile update path, so public records always display the auto-generated name rather than an organization-chosen one. Affected users: organizations wanting their chosen name to appear on public aid records. Current behavior: no profile update API or UI exists; the generated name is permanent. Expected behavior: an authenticated organization wallet can read and update its display name; the change propagates to both pre-existing and new aid records. Evidence: `server/records.ts` (organization record handling) and `src/App.tsx` (profile rendering).

## Acceptance criteria

- A request authenticated as organization A targeting organization B's profile returns `403` and writes nothing.
- Submitting a display name that normalizes to an existing organization's name returns `409` and performs no write.
- A record fetch after a display-name change renders the updated organization name for both pre-existing and newly created aid records.
- The successful update inserts exactly one audit event.
- `npm test -- tests/backend.test.ts` passes.

## Files to touch

- `server/records.ts`
- `migrations/` (only if a constraint or metadata field is needed)
- `src/App.tsx`
- `tests/backend.test.ts`

## Test expectations

- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`
- Requires `TEST_DATABASE_URL` and `TEST_DATABASE_BRANCH=test` for the authorization and uniqueness cases.

## Out of scope

Organization discovery, logos, contact data, or beneficiary acknowledgment.

## Depends on

None
