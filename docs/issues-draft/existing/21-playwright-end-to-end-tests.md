# Playwright End-to-End Tests

**Complexity:** high

## Context

The whole suite is Vitest/Supertest: `tests/*.test.ts` (for example `tests/api.test.ts`,
`tests/backend.test.ts`, `tests/freighter.test.ts`). Nothing renders the React app in a
browser. On `main` there is **no** `playwright.config.ts`, no `tests/e2e/` directory, and
no Playwright dependency in `package.json`, so wallet flows are only exercised through the
mocked provider unit test and have never run against the rendered UI.

`src/freighter.ts` wraps the public Freighter provider API, and `.github/workflows/ci.yml`
already stands up a `postgres:16` service and runs `npm ci`, `typecheck`, `lint`,
`format:check`, `build`, `test`, `smoke` and `npm audit` — but no browser step.

Affected users: contributors and reviewers who cannot currently prove a full
login-to-verification journey without a real wallet. Expected behavior: deterministic
browser coverage that mocks only the Freighter provider and never needs a seed phrase or a
mainnet transaction.

## Acceptance criteria

- A `playwright.config.ts` is added and a documented command (for example `npm run
test:e2e`) runs the browser suite locally.
- `.github/workflows/ci.yml` runs the browser suite; the run is green from a clean checkout
  and does not require production credentials.
- The suite mocks only the public Freighter provider API behind `src/freighter.ts` and uses
  generated test keypairs/signatures; no seed phrase, private key or real transaction is
  ever used.
- Coverage exists for: login via the mocked provider, role-aware UI, ledger filtering,
  mismatch vs verified display, and sign-out.
- Browser tests point at a disposable test database and mocked Horizon responses; no mainnet
  request is made.
- Traces/screenshots are captured only on failure.
- `npm run check` continues to pass.

## Files to touch

- `package.json`, `package-lock.json`
- `playwright.config.ts`
- `tests/e2e/`
- `.github/workflows/ci.yml`
- `CONTRIBUTING.md` (how to run the browser tests)

## Test expectations

- Run the browser suite against a dedicated test database with mocked Horizon responses.
- Assert the mocked provider is the only stub and that no network call reaches Freighter or
  mainnet.
- Confirm failure artifacts are produced and that the suite is stable across repeated runs.
- Run: `npm run check`.

## Out of scope

Any change to the authentication or signature-verification code. Replacing the existing
Vitest/Supertest suite. Driving the real Freighter browser extension or any mainnet
transaction.

## Depends on

None, but the mock must track the public provider interface exposed by the Freighter
wrapper module (`src/freighter.ts`).
