# Add an HTTP Smoke Check for a Deployed Demo URL

**Complexity:** intermediate

## Context

The existing smoke script exercises an in-process Express app only; it cannot verify a manually deployed Vercel URL. Operators preparing a deployment cannot confirm the live frontend loads and the health endpoint responds without running a full E2E browser test. Affected users: maintainers and operators verifying a demo or staging deployment. Current behavior: `npm run smoke` tests only an in-process Express server, not a remotely deployed URL. Expected behavior: a separate command accepts a base URL, checks frontend HTTP status plus `/api/_healthcheck` JSON with bounded timeouts, and reports liveness and readiness distinctly. Output must contain only statuses and no environment values or response bodies beyond the health boolean. Evidence: `scripts/smoke.ts` (current local smoke implementation) and `docs/demo-deployment.md`.

## Acceptance criteria

- Against a healthy demo the command returns success; against a mock server returning non-200 or malformed health JSON it exits non-zero with a concise status.
- A local mock server tests success, timeout, and failure cases and `npm test -- tests/smoke.test.ts` passes.
- Output contains only statuses/booleans and never environment values or response bodies beyond the health boolean.

## Files to touch

- `scripts/smoke.ts` or `scripts/smoke-remote.ts`
- `package.json`
- `tests/` (smoke command tests)
- `docs/demo-deployment.md`

## Test expectations

- Run: `npm test -- tests/smoke.test.ts`
- Run: `npm run typecheck`
- Run: `npm run smoke` to confirm the unchanged local smoke path still works.

## Out of scope

GitHub Actions deployment automation or Playwright/Freighter browser journeys (tracked by a separate open issue on E2E tests).

## Depends on

Add a Database Readiness Probe
