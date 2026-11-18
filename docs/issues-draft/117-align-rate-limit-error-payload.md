# Align the Rate-Limit Response With the Documented Error Contract

**Complexity:** intermediate

## Context

The API documents a human-readable error contract (`{ "error": "..." }` in `docs/api.md`, line 3), and every hand-written failure follows it (e.g. `{ error: 'Too many challenges. Wait a few minutes and try again.' }` in `server/auth.ts`, line 186). The three `express-rate-limit` limiters break that contract by returning a machine code as the message: `server/rate-limits.ts` (lines 11 and 21) both use `message: { error: 'rate_limit_exceeded' }`. Those limiters are mounted on `/api` and `/api/auth` routes in `server/app.ts` (lines 14Ã¢â‚¬â€œ15). A client cannot distinguish "you are rate limited" from validation errors by shape, and the frontend surfaces whatever string it receives via `ApiError` in `src/api.ts`. Affected: frontend users seeing `rate_limit_exceeded` instead of an actionable message.

## Acceptance criteria

- An over-limit request to `/api/transparency` (public-read limiter), `/api/auth/challenge` (auth limiter), and a generic `/api/*` route returns HTTP 429 with a non-empty human-readable `error` string and, if introduced, `code: 'rate_limit_exceeded'`.
- A test asserts the body shape for at least one limiter.
- `docs/api.md` shows the 429 example.
- `npm test`, `npm run typecheck`, and `npm run lint` pass.

## Files to touch

- `server/rate-limits.ts`
- `docs/api.md`
- `tests/backend.test.ts` (a test that the 429 body matches the documented shape)

## Test expectations

- Lower `API_RATE_LIMIT_MAX` to a small value in a local env file, start `npm run dev:server`, and issue repeated requests to observe the 429 body; restore the value afterwards.
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`, `npm run lint`

## Out of scope

Changing limit values, moving limits to a shared store (tracked by "Share Per-IP Rate Limits Across Serverless Instances"), adding per-route limits, or retry behavior in the frontend.

## Depends on

None
