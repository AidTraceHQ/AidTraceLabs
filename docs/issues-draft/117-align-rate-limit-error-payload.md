# Align the Rate-Limit Response With the Documented Error Contract

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 5 hours

**Release day:** Day 2

## Problem statement

The API documents a human-readable error contract — "Error responses use `{ "error": "..." }`"
(`docs/api.md:3`) — and every hand-written failure follows it, for example
`{ error: 'Too many challenges. Wait a few minutes and try again.' }` (`server/auth.ts:186`) and
`{ error: 'A valid Stellar public address and network are required.' }` (`server/auth.ts:182`).

The three `express-rate-limit` limiters break that contract by returning a machine code as the message:

- `server/rate-limits.ts:11` — `message: { error: 'rate_limit_exceeded' }`
- `server/rate-limits.ts:21` — `message: { error: 'rate_limit_exceeded' }`

Those limiters are mounted on `app.use('/api', apiIpRateLimit)` and `app.use('/api/auth', authIpRateLimit)`
(`server/app.ts:14-15`), so an over-limit request can return the code string while database-backed
limits return a sentence. A client cannot distinguish "you are rate limited" from validation errors by
shape, and the frontend surfaces whatever string it receives
(`src/api.ts` throws `ApiError` with the server message).

Affected: frontend users seeing `rate_limit_exceeded` instead of an actionable message, and any client
that parses `error` as display text.

## Technical implementation requirements

- Give each limiter a short actionable sentence, consistent between the API-wide, auth, and public-read
  limiters, for example `{ error: 'Too many requests. Wait a few minutes and try again.' }`.
- Where a client needs to branch on the cause, add a stable machine-readable field alongside the
  message (for example `{ error: '...', code: 'rate_limit_exceeded' }`) instead of overloading `error`.
  If a `code` field is added, document it in `docs/api.md`.
- Keep `standardHeaders: 'draft-8'` and `legacyHeaders: false` (`server/rate-limits.ts:9-10, 19-20`)
  unchanged; the rate-limit headers themselves are correct.
- Do not change the configured windows or maxima (`server/rate-limits.ts:28-41`), the `skip` predicate
  for public reads (`server/rate-limits.ts:22-25`), or any status code (429 stays 429).
- Do not weaken or bypass a limit.

## Files and areas to touch

- `server/rate-limits.ts`
- `docs/api.md`
- `tests/backend.test.ts` (a test that the 429 body matches the documented shape)

## Dependencies

- Coordinate with draft "Document the API error and status-code contract" (document the API error contract): this issue makes the limiter conform to
  it; "Document the API error and status-code contract" documents the contract. Do not duplicate the doc edit — add the rate-limit example to
  whichever lands second.

## Measurable acceptance criteria

- An over-limit request to `/api/transparency` (public-read limiter), `/api/auth/challenge`
  (auth limiter), and a generic `/api/*` route returns HTTP 429 with a non-empty human-readable `error`
  string and, if introduced, `code: 'rate_limit_exceeded'`.
- A test asserts the body shape for at least one limiter.
- `docs/api.md` shows the 429 example.
- `npm test`, `npm run typecheck`, and `npm run lint` pass.

## Expected deliverables

- The corrected limiter messages, an optional `code` field with its documentation, and a test.

## How to set up and run tests

- Lower `API_RATE_LIMIT_MAX` to a small value in a local env file, start `npm run dev:server`, and issue
  repeated requests to observe the 429 body; restore the value afterwards.
- `npm test -- tests/backend.test.ts`
- `npm run typecheck` and `npm run lint`.

## Out of scope

- Changing limit values, moving limits to a shared store (draft "Share Per-IP Rate Limits Across Serverless Instances"), adding per-route limits, or
  retry behaviour in the frontend (`src/api.ts`).

## Suggested labels

- `area: backend`, `type: bug`, `difficulty: medium`.
