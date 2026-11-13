# Test the Authorization Matrix for Every Protected Route

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 18 hours

**Release day:** Day 2

## Problem statement

Protected routes enforce roles centrally (`server/records.ts:326-355`, role check at `server/records.ts:337-340`). The suite covers a donor's forbidden create (`tests/backend.test.ts:798`), a cross-organization edit (`tests/backend.test.ts:822`), an unauthenticated `/api/records` (`tests/backend.test.ts:57-58`), and self-removal (`tests/backend.test.ts:883-884`). It never checks an unauthenticated 401 or a wrong-role 403 on `/api/admin/roles`, `/api/audit`, `/api/beneficiary`, `/api/records/:id/verify`, or `/api/records/:id/void`. Affected: any role whose boundary is assumed but not asserted.

## Technical implementation requirements

- Add a table-style test enumerating protected routes across {anonymous, donor, beneficiary, organization, admin}, asserting 401 with no session, 403 for a disallowed role, and success for the permitted role.
- Include read routes (`/api/beneficiary`, `/api/admin/roles`, `/api/audit`) and write routes (`POST /api/records`, `PUT /api/records/:id`, `/api/records/:id/verify`, `/api/records/:id/void`). Note that `/api/records/:id/verify` accepts any authenticated session (`server/records.ts:871`), so it has no role-403 case — record that explicitly instead of asserting one.
- Keep Origin and CSRF valid for the authenticated cases so only the role gate is under test.
- Do NOT change any role policy, the `allowedRoles` lists, or the last-admin guards.

## Files and areas to touch

- `tests/backend.test.ts`

## Dependencies

- Requires a test database. Distinct from last-admin protection and from client-side role refresh.

## Measurable acceptance criteria

- Every protected route returns 401 without a session and, where a role is disallowed, 403; permitted roles succeed.
- `npm test -- tests/backend.test.ts` passes; `npm run typecheck` passes.

## Expected deliverables

- A documented route/role matrix test.

## How to set up and run tests

- Configure `TEST_DATABASE_URL`/`TEST_DATABASE_BRANCH=test`, then `npm test -- tests/backend.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- Changing role permissions, adding roles, or UI control visibility.

## Suggested labels

- `area: security`, `area: testing`, `type: enhancement`, `difficulty: high`.
