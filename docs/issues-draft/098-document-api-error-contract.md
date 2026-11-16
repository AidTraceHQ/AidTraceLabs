# Document the API Error and Status-Code Contract

**Complexity:** medium

## Context

`docs/api.md` lists every route and states one error shape (line 3) but never documents which status codes the API returns or when. A contributor integrating with the API cannot tell from the docs what `400`, `401`, `403`, `404`, `409`, `413`, `429`, `503`, or `500` mean, which failures are retryable, or that CSRF/Origin failures on protected writes are distinct from an expired session. The behavior exists in `server/app.ts` (lines 28–53), `server/records.ts`, and `server/database-errors.ts` (function `databaseUnavailableResponse`, lines 58–66) and surfaces only in tests. Affected: API consumers and onboarding contributors.

## Acceptance criteria

- An error-contract section in `docs/api.md` contains a table covering at least: malformed JSON (`400`), body too large (`413`), missing/invalid CSRF or Origin on protected writes, expired/invalid session (`401`), forbidden role/organization (`403`), not found (`404`), record conflict (`409`), rate limited (`429`), database unavailable (`503`), and unexpected (`500`).
- Each listed code names the triggering condition and states whether it is safe to retry.
- `npm run format:check` passes.

## Files to touch

- `docs/api.md`
- `docs/architecture.md` (optional cross-reference)

## Test expectations

- Cross-check each row against the handler or test named in it.
- Run: `npm run format:check`
- No application code change.

## Out of scope

Generating an OpenAPI document, changing any status code, and client error-handling changes.

## Depends on

None
