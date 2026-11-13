# Test Filter Input Handling and Control-Character Stripping

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 3

## Problem statement

List filters are built with placeholders (`server/records.ts:422-425`) and the free-text `q` search uses a parameterized `strpos(lower(...), lower($n))` (`server/records.ts:571-583`, `server/records.ts:1258-1270`), while stored text is stripped of control characters (`server/records.ts:93-100`). No test asserts that SQL metacharacters are treated literally or that control characters are removed, so a future refactor that inlined values would not be caught. Affected: public ledger and admin views whose query integrity and stored-text hygiene are assumed.

## Technical implementation requirements

- Add API tests sending values such as `q=%' OR TRUE --`, `q='; DROP`, and filter values containing `%`/`_`, asserting results match literal substrings and the query set is not broadened (`server/records.ts:571-583`).
- Add a test proving stored text drops C0 control characters (the ranges in `server/records.ts:93-100`, which keep tab, line feed, and carriage return) and is trimmed/truncated. Because the helper is not exported, assert this through an API round-trip (create with control characters in `note`, read back) rather than changing its visibility.
- Keep queries parameterized; do NOT introduce string interpolation, `LIKE`-escaping changes, or new query building.
- Do NOT change filter semantics or length limits unless a test proves a real defect.

## Files and areas to touch

- `tests/backend.test.ts` (database-backed injection and sanitization cases)

## Dependencies

- Requires a test database. Distinct from the rejection-auditing and safe-logging drafts.

## Measurable acceptance criteria

- Metacharacter inputs return only literal matches, never the full table.
- Control characters are removed from stored text returned by the API.
- `npm test -- tests/backend.test.ts` passes; `npm run typecheck` passes.

## Expected deliverables

- Injection-regression and sanitization tests.

## How to set up and run tests

- Configure `TEST_DATABASE_URL`/`TEST_DATABASE_BRANCH=test`, then `npm test -- tests/backend.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- Changing the query builder, adding an ORM, or introducing new escaping rules.

## Suggested labels

- `area: security`, `area: testing`, `type: enhancement`, `difficulty: medium`.
