# Share Per-IP Rate Limits Across Serverless Instances

**Complexity:** Advanced (High, 200 pts)

**Estimated effort:** 10 hours

**Release day:** Day 1

## Problem statement

The current per-IP API/auth/public-read counters use an in-memory store, so separate Vercel instances do not share limits.

## Technical implementation requirements

- Select a durable/shared rate-limit store supported by the deployment architecture.
- Keep the existing route-specific windows/limits configurable and preserve trusted-proxy IP handling.
- Define bounded failure behavior if the shared store is unavailable.
- Reconcile the stale statement in `docs/backend-design.md` with the implemented per-process limits and the new shared-store behavior.

## Files and areas to touch

- `server/rate-limits.ts`
- `server/environment.ts`
- `package.json` and lockfile only if a justified store adapter is selected
- `tests/rate-limits.test.ts`
- `docs/deployment.md`

## Dependencies

- None. Existing GitHub issue #20 covers outbound alerts, not inbound abuse controls.

## Measurable acceptance criteria

- An integration test starts two independent app instances sharing the configured store and asserts that after instance A exhausts the limit, instance B returns the rate-limit rejection (e.g. `429`) for the same IP.
- Existing endpoint-limit and trusted-proxy tests in `tests/rate-limits.test.ts` still pass.
- A test with the shared store unavailable asserts behavior is explicit and bounded and does not silently disable all limits.
- `npm test -- tests/rate-limits.test.ts` passes.

## Expected deliverables

- Shared store adapter/configuration, integration tests, and deployment setup instructions.

## How to set up and run tests

- `npm test -- tests/rate-limits.test.ts`
- `npm run typecheck`
- `npm run check`

## Out of scope

- Changing authentication policy, increasing limits, or adding email/webhook alerts.

## Suggested labels

- `area: security`, `area: infrastructure`, `type: enhancement`, `difficulty: high`.
