# Share Per-IP Rate Limits Across Serverless Instances

**Publish:** Day 1

**Size:** High

## Problem statement

The current per-IP API/auth/public-read counters use an in-memory store, so separate Vercel instances do not share limits.

## Technical requirements

- Select a durable/shared rate-limit store supported by the deployment architecture.
- Keep the existing route-specific windows/limits configurable and preserve trusted-proxy IP handling.
- Define bounded failure behavior if the shared store is unavailable.
- Reconcile the stale statement in `docs/backend-design.md` with the implemented per-process limits and the new shared-store behavior.

## Files to touch

- `server/rate-limits.ts`
- `server/environment.ts`
- `package.json` and lockfile only if a justified store adapter is selected
- `tests/rate-limits.test.ts`
- `docs/deployment.md`

## Dependencies on other issues

- None. #20 covers outbound alerts, not inbound abuse controls.

## Acceptance criteria

- Two independent app instances observe the same per-IP counter in an integration test.
- Existing endpoint limits and trusted-proxy behavior remain covered.
- Store outage behavior is explicit, bounded, and does not silently disable all limits.

## Deliverables

- Shared store adapter/configuration, integration tests, and deployment setup instructions.

## How to run tests

- `npm test -- tests/rate-limits.test.ts`
- `npm run typecheck`
- `npm run check`

## Out of scope

- Changing authentication policy, increasing limits, or adding email/webhook alerts.

## Suggested labels

- `area: security`, `area: infrastructure`, `type: enhancement`, `difficulty: high`.
