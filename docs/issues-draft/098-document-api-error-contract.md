# Document the API error and status-code contract

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 5

## Problem statement

`docs/api.md` lists every route and states one error shape (`docs/api.md:3`) but never documents
which status codes the API returns or when. A contributor integrating with the API cannot tell from
the docs what `400`, `401`, `403`, `404`, `409`, `413`, `429`, `503`, or `500` mean here, which
failures are retryable, or that CSRF/Origin failures on protected writes are distinct from an expired
session. The behaviour exists in code (`server/app.ts:28-53`, `server/records.ts`,
`server/database-errors.ts:58-66`) and only surface in tests. Affected: API consumers and onboarding
contributors.

## Technical implementation requirements

- Add an error-contract section to `docs/api.md` with a table of status codes, the condition that
  produces each, and the response body shape (`{ "error": "..." }`).
- Cover at least: malformed JSON (`400`), body too large (`413`), missing/invalid CSRF or Origin on
  protected writes, expired/invalid session (`401`), forbidden role/organization (`403`),
  not found (`404`), record conflict (`409`), rate limited (`429`), database unavailable (`503`),
  unexpected (`500`).
- State which codes are safe to retry and reference the existing behaviour rather than inventing new
  semantics.
- Do not change any handler, status code, or body.

## Files and areas to touch

- `docs/api.md`
- `docs/architecture.md` (optional cross-reference)

## Dependencies

- Complementary to the "add copyable API request/response examples" draft ("Add Concrete API Contract Examples"). That draft adds
  examples; this documents the error/status contract. Keep the two sections from restating each other.

## Measurable acceptance criteria

- Every status code the API can emit for `/api/*` appears in the table with a triggering condition.
- Each listed code is verifiable against the referenced code path or an existing test
  (`tests/backend.test.ts`).
- `npm run format:check` passes (docs are Prettier-formatted).

## Expected deliverables

- An error/status-contract section in `docs/api.md`.

## How to set up and run tests

- Cross-check each row against the handler or test named in it.
- Run `npm run format:check`.

## Out of scope

- Generating an OpenAPI document, changing any status code, and client error-handling changes.

## Suggested labels

- `area: docs`, `type: documentation`, `difficulty: medium`
