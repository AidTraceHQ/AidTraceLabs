# Add Concrete API Contract Examples

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 4

## Problem statement

`docs/api.md:1-25` lists routes and query names but directs readers to source handlers for exact schemas. Contributors cannot see representative request/response envelopes for challenge login, record validation, or signed cursor pagination in one place.

## Technical implementation requirements

- Add safe JSON examples for challenge issue, session result, record create, validation/conflict errors, and a paginated list with `nextCursor`/`hasMore`.
- Mark wallet addresses, hashes, cookies, CSRF values, and database URLs as clearly synthetic placeholders; never include a live token or signed message.
- State that examples are illustrative and link each example to the handler/test that enforces it.
- Keep the guide aligned with actual integration test responses.

## Files and areas to touch

- `docs/api.md`
- `tests/backend.test.ts` only if an example reveals an undocumented contract mismatch

## Dependencies

- None.

## Measurable acceptance criteria

- Every documented example matches current JSON keys/types and status codes.
- Pagination example explains that cursors are opaque and filter-bound.
- No real wallet secret, session cookie, CSRF token, or connection string appears.

## Expected deliverables

- Reviewed API examples and links to their contract tests.

## How to set up and run tests

- Run `npm run format:check`.
- Verify each example against its named Supertest case in `tests/backend.test.ts`.

## Out of scope

- Generating a full OpenAPI specification or changing route behavior/authentication.

## Suggested labels

- `area: docs`, `type: documentation`, `difficulty: medium`.
