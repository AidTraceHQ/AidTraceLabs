# Require Explicit Target Confirmation for Admin Seeding

**Publish:** Day 1

**Size:** High

## Problem statement

The admin seed validates the wallet and presence of `DATABASE_URL`, then writes the role without identifying or confirming the database branch.

## Technical requirements

- Require a non-secret target environment/branch confirmation for production-like seeding.
- Print only the target label and wallet suffix; never print connection strings or full addresses.
- Keep bootstrap available for authorized first-admin setup and make test seeding explicit.

## Files to touch

- `scripts/seed-admin.ts`
- `scripts/seed-admin.test.ts`
- `docs/deployment.md`

## Dependencies on other issues

- #13 informs the runtime/bootstrap credential separation.

## Acceptance criteria

- Missing or mismatched target confirmation causes a safe no-write failure.
- Correctly confirmed dev/test/demo and documented production bootstrap paths work.
- Tests prove no role write occurs when the target is unconfirmed.

## Deliverables

- Explicit seed-target guard, tests, and an operator command example with no secrets.

## How to run tests

- `npm test -- tests/seed-admin.test.ts`
- `npm run typecheck`

## Out of scope

- A public admin bootstrap endpoint or changes to wallet authentication.

## Suggested labels

- `area: security`, `area: backend`, `type: enhancement`, `difficulty: high`.
