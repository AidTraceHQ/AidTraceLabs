# Test Filter Input Handling and Control-Character Stripping

**Complexity:** intermediate

## Context

List filters are built with placeholders in `server/records.ts` (lines 422Ã¢â‚¬â€œ425) and the free-text `q` search uses a parameterized `strpos(lower(...), lower($n))` (lines 571Ã¢â‚¬â€œ583 and 1258Ã¢â‚¬â€œ1270), while stored text is stripped of control characters (lines 93Ã¢â‚¬â€œ100). No test asserts that SQL metacharacters are treated literally or that control characters are removed from stored values, so a future refactor that inlined values would not be caught. Affected: public ledger and admin views whose query integrity and stored-text hygiene are assumed.

## Acceptance criteria

- Tests sending `q=%' OR TRUE --`, `q='; DROP`, and filter values containing `%`/`_` assert results match only literal substrings and the query set is not broadened.
- A test proves stored text drops C0 control characters (the ranges in lines 93Ã¢â‚¬â€œ100, keeping tab, line feed, and carriage return) by creating a record with control characters in `note` and reading it back through the API.
- `npm test -- tests/backend.test.ts` passes; `npm run typecheck` passes.

## Files to touch

- `tests/backend.test.ts` (database-backed injection and sanitization cases)

## Test expectations

- Configure: `TEST_DATABASE_URL`/`TEST_DATABASE_BRANCH=test`
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Changing the query builder, adding an ORM, or introducing new escaping rules.

## Depends on

None
