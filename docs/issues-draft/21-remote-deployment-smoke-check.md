# Add an HTTP Smoke Check for a Deployed Demo URL

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 3

## Problem statement

The existing smoke script exercises an in-process Express app only; it cannot verify a manually deployed Vercel URL.

## Technical implementation requirements

- Add a separate command that accepts a base URL and checks frontend HTTP status plus `/api/_healthcheck` JSON.
- Use HTTPS by default, bounded timeouts, and safe output containing statuses only.
- Keep local `npm run smoke` behavior unchanged.

## Files and areas to touch

- `scripts/smoke.ts` or `scripts/smoke-remote.ts`
- `package.json`
- `tests/` (smoke command tests)
- `docs/demo-deployment.md`

## Dependencies

- "Add a Database Readiness Probe" readiness probe may add a separate readiness URL; this check should report liveness/readiness distinctly if available.

## Measurable acceptance criteria

- Against a healthy demo the command returns success; against a mock server returning non-200 or malformed health JSON it exits non-zero with a concise status.
- A local mock server tests success, timeout, and failure cases and `npm test -- tests/smoke.test.ts` passes.
- Output contains only statuses/booleans and never environment values or response bodies beyond the health boolean.

## Expected deliverables

- Remote smoke command, tests, and manual redeploy checklist update.

## How to set up and run tests

- `npm test -- tests/smoke.test.ts`
- `npm run typecheck`
- `npm run smoke` for the unchanged local smoke path.

## Out of scope

- GitHub Actions deployment automation or Playwright/Freighter journeys (existing GitHub issue #21).

## Suggested labels

- `area: infrastructure`, `area: testing`, `type: enhancement`, `difficulty: medium`.
