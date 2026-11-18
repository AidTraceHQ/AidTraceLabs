# Test the Authorization Matrix for Every Protected Route

**Complexity:** advanced

## Context

Protected routes enforce roles centrally in `server/records.ts` (role check at lines 326Ã¢â‚¬â€œ355 and 337Ã¢â‚¬â€œ340). The suite covers a donor's forbidden create, a cross-organization edit, an unauthenticated `/api/records`, and self-removal. It never checks an unauthenticated 401 or a wrong-role 403 on `/api/admin/roles`, `/api/audit`, `/api/beneficiary`, `/api/records/:id/verify`, or `/api/records/:id/void`. Affected: any role whose boundary is assumed but not asserted. Note: `/api/records/:id/verify` accepts any authenticated session (line 871), so it has no role-403 case Ã¢â‚¬â€ that must be recorded explicitly rather than asserted.

## Acceptance criteria

- A table-style test enumerates protected routes across {anonymous, donor, beneficiary, organization, admin}, asserting 401 with no session, 403 for a disallowed role, and success for the permitted role.
- Read routes (`/api/beneficiary`, `/api/admin/roles`, `/api/audit`) and write routes (`POST /api/records`, `PUT /api/records/:id`, `/api/records/:id/verify`, `/api/records/:id/void`) are included.
- Origin and CSRF are valid for the authenticated cases so only the role gate is under test.
- `npm test -- tests/backend.test.ts` passes; `npm run typecheck` passes.

## Files to touch

- `tests/backend.test.ts`

## Test expectations

- Configure: `TEST_DATABASE_URL`/`TEST_DATABASE_BRANCH=test`
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Changing role permissions, adding roles, or UI control visibility.

## Depends on

None
