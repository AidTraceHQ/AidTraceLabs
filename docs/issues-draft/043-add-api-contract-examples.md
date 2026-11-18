# Add Concrete API Contract Examples

**Complexity:** intermediate

## Context

`docs/api.md` (lines 1Ã¢â‚¬â€œ25) lists routes and query names but directs readers to source handlers for exact schemas. Contributors cannot see representative request/response envelopes for challenge login, record validation, or signed cursor pagination in one place. Affected users: contributors building integrations and onboarding developers. Current behavior: API doc has route signatures but no JSON examples. Expected behavior: safe synthetic JSON examples are provided for challenge issue, session result, record create, validation/conflict errors, and a paginated list with `nextCursor`/`hasMore`. Each example links to the handler or test that enforces it.

## Acceptance criteria

- Every documented example matches current JSON keys/types and status codes.
- Pagination example explains that cursors are opaque and filter-bound.
- No real wallet secret, session cookie, CSRF token, or connection string appears.

## Files to touch

- `docs/api.md`
- `tests/backend.test.ts` (only if an example reveals an undocumented contract mismatch)

## Test expectations

- Run: `npm run format:check`
- Verify each example against its named Supertest case in `tests/backend.test.ts`.

## Out of scope

Generating a full OpenAPI specification or changing route behavior/authentication.

## Depends on

None
