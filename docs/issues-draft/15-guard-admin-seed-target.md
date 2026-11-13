# Require Explicit Target Confirmation for Admin Seeding

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 1

## Problem statement

The admin seed validates the wallet and presence of `DATABASE_URL`, then writes the role without identifying or confirming the database branch.

## Technical implementation requirements

- Require a non-secret target environment/branch confirmation for production-like seeding.
- Print only the target label and wallet suffix; never print connection strings or full addresses.
- Keep bootstrap available for authorized first-admin setup and make test seeding explicit.

## Files and areas to touch

- `scripts/seed-admin.ts`
- `scripts/seed-admin.test.ts`
- `docs/deployment.md`

## Dependencies

- "Separate Runtime and Migration Database Roles" informs the runtime/bootstrap credential separation.

## Measurable acceptance criteria

- `tests/seed-admin.test.ts` asserts a run with a missing or mismatched target confirmation exits non-zero and performs no role write.
- A test asserts the confirmed dev/test/demo and documented production bootstrap paths each write exactly one role.
- A test asserts the output contains only the target label and wallet suffix and never the connection string or full address.
- `npm test -- tests/seed-admin.test.ts` passes.

## Expected deliverables

- Explicit seed-target guard, tests, and an operator command example with no secrets.

## How to set up and run tests

- `npm test -- tests/seed-admin.test.ts`
- `npm run typecheck`

## Out of scope

- A public admin bootstrap endpoint or changes to wallet authentication.

## Suggested labels

- `area: security`, `area: backend`, `type: enhancement`, `difficulty: medium`.
