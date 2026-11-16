# Share Per-IP Rate Limits Across Serverless Instances

**Complexity:** high

## Context

The current per-IP API/auth/public-read rate-limit counters use an in-memory store (`server/rate-limits.ts`), so separate Vercel serverless instances do not share limits. A single client can exhaust the limit on one instance and be served unrestricted by another. Affected users: all users of the API under a serverless deployment where multiple instances run concurrently. Current behavior: each process holds its own counter; limits are per-process. Expected behavior: counters are shared across instances so the configured rate is enforced globally. Failure of the shared store must be bounded and must not silently disable all limits. Evidence: `server/rate-limits.ts` (rate limiter configuration) and `docs/backend-design.md` (stale per-process statement).

## Acceptance criteria

- An integration test starts two independent app instances sharing the configured store and asserts that after instance A exhausts the limit, instance B returns `429` for the same IP.
- Existing endpoint-limit and trusted-proxy tests in `tests/rate-limits.test.ts` still pass.
- A test with the shared store unavailable asserts behavior is explicit, bounded, and does not silently disable all limits.
- `npm test -- tests/rate-limits.test.ts` passes.

## Files to touch

- `server/rate-limits.ts`
- `server/environment.ts`
- `package.json` and lockfile (only if a justified store adapter is selected)
- `tests/rate-limits.test.ts`
- `docs/deployment.md`

## Test expectations

- Run: `npm test -- tests/rate-limits.test.ts`
- Run: `npm run typecheck`
- Run: `npm run check`
- Requires a shared-store instance for the integration cases.

## Out of scope

Changing authentication policy, increasing limits, or adding email/webhook alerts. Outbound alerts are tracked by a separate open issue.

## Depends on

None
