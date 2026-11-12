# Add an HTTP Smoke Check for a Deployed Demo URL

**Publish:** Day 3

**Size:** Medium

## Problem statement

The existing smoke script exercises an in-process Express app only; it cannot verify a manually deployed Vercel URL.

## Technical requirements

- Add a separate command that accepts a base URL and checks frontend HTTP status plus `/api/_healthcheck` JSON.
- Use HTTPS by default, bounded timeouts, and safe output containing statuses only.
- Keep local `npm run smoke` behavior unchanged.

## Files to touch

- `scripts/smoke.ts` or `scripts/smoke-remote.ts`
- `package.json`
- `tests/` (smoke command tests)
- `docs/demo-deployment.md`

## Dependencies on other issues

- #08 readiness probe may add a separate readiness URL; this check should report liveness/readiness distinctly if available.

## Acceptance criteria

- The command succeeds for a healthy demo and fails with a concise status for non-200 or malformed health responses.
- A local mock server can test success, timeout, and failure cases.
- Output never prints environment values or response bodies beyond the health boolean.

## Deliverables

- Remote smoke command, tests, and manual redeploy checklist update.

## How to run tests

- `npm test -- tests/smoke.test.ts`
- `npm run typecheck`
- `npm run smoke` for the unchanged local smoke path.

## Out of scope

- GitHub Actions deployment automation or Playwright/Freighter journeys (#21).

## Suggested labels

- `area: infrastructure`, `area: testing`, `type: enhancement`, `difficulty: medium`.
