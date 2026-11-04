# Playwright End-to-End Tests

**Complexity:** high

## Context

The current suite is Vitest/Supertest. Add browser coverage using a mocked Freighter provider so wallet flows are deterministic and never require a seed phrase or real transaction.

## Acceptance criteria

- Add Playwright setup that can run locally and in CI.
- Mock only the public Freighter provider API and use generated test keys/signatures.
- Cover login, role-aware UI, ledger filtering, mismatch/verified display, and sign-out.
- Keep browser tests isolated from production credentials and mainnet transactions.

## Files to touch

- `package.json`
- `playwright.config.ts`
- `tests/e2e/`
- `.github/workflows/ci.yml`
- `docs/CONTRIBUTING.md` or root `CONTRIBUTING.md`

## Test expectations

- Run browser tests against a dedicated test database and mocked Horizon responses.
- Assert accessible interactions and capture artifacts only on failure.
