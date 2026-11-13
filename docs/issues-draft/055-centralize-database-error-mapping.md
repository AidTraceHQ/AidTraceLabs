# Centralize Database Error-to-Response Mapping

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 2

## Problem statement

Unique-violation handling exists only as an ad-hoc `23505` check (`server/records.ts:611-613`, the `uniqueViolation` helper) used in exactly two places (the catch block in the `POST /api/records` handler at `server/records.ts:838-844` and the catch block in the `PUT /api/records/:id` handler at `server/records.ts:997-1003`). Every other database error reaches the generic 500 branch of the `errorHandler` middleware (`server/app.ts:47-52`): the admin role writes can raise foreign-key (`23503`) or check (`23514`) violations (the `INSERT ... ON CONFLICT` in the `POST /api/admin/roles` handler, `server/records.ts:1147-1161`), and there is no shared translation from SQLSTATE to an HTTP status outside the transient 503 path (`server/database-errors.ts:58-66`, the `databaseUnavailableResponse` function). The `error` object's `status`/`statusCode` is never consulted (confirmed by searching `server/` for both). Affected: API clients and operators who receive 500 for determinable client errors.

## Technical implementation requirements

- Add a single set of SQLSTATE helpers alongside the existing classifier (for example `isUniqueViolation`, `isForeignKeyViolation`, `isCheckViolation`) and use them consistently in the write handlers.
- Map unique conflicts to 409, foreign-key/check violations to a 4xx with a clear `{ "error": "..." }` message, and leave the transient 503 mapping unchanged.
- Preserve every current message and status for existing paths, including the duplicate network/hash 409 (`server/records.ts:839-841` in the `POST /api/records` catch, `server/records.ts:998-1000` in the `PUT /api/records/:id` catch).
- Do NOT add new database constraints (tracked separately) and do NOT change the 503 body or the malformed-JSON/oversized-body mappings.

## Files and areas to touch

- `server/records.ts`
- `server/database-errors.ts`
- `tests/backend.test.ts`

## Dependencies

- Complementary to the database-invariants draft (034); if that lands, these mappings cover the new constraints.

## Measurable acceptance criteria

- A test in `tests/backend.test.ts` that triggers a `23503` or `23514` on a write route observes a 4xx status (not 500) with a `{ "error": string }` body.
- The existing duplicate-hash assertion in `tests/backend.test.ts` ('verifies the matching source, stores evidence, and rejects duplicate network hashes') still observes 409 with message `A record already exists for this network and transaction hash.`
- The transient 503 path still returns exactly `{ "error": "database_unavailable" }`.
- `npm test -- tests/backend.test.ts` passes and `npm run typecheck` passes.

## Expected deliverables

- Shared SQLSTATE-to-response helpers, their use in the write handlers, and coverage tests.

## How to set up and run tests

- These cases are exercised against the integration database; configure `TEST_DATABASE_URL` and `TEST_DATABASE_BRANCH=test`, then run `npm test -- tests/backend.test.ts`.
- Run `npm run typecheck`.

## Out of scope

- New constraints, changes to the 503 mapping, retry behavior, or general request validation.

## Suggested labels

- `area: backend`, `type: enhancement`, `difficulty: medium`
