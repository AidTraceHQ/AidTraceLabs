# Define Security Headers for API and Static Responses

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 3

## Problem statement

The API disables `x-powered-by`, but there is no deliberate browser security-header policy in Express or Vercel configuration.

## Technical implementation requirements

- Select and document compatible values for content type sniffing, framing, referrer, permissions, and transport security.
- Configure static Vercel responses and API responses consistently where appropriate.
- Test that wallet/Freighter flows and required external Horizon/explorer links continue to work.

## Files and areas to touch

- `server/app.ts`
- `vercel.json`
- `tests/backend.test.ts`
- `docs/deployment.md`

## Dependencies

- None.

## Measurable acceptance criteria

- A test asserts the frontend and API responses carry the documented headers (content type sniffing, framing, referrer, permissions, transport security) with the documented values.
- A test asserts any introduced CSP contains no wildcard source (`*`) and lists only documented required sources.
- Existing wallet/Freighter and external-link route tests still pass and `npm run build` succeeds.
- `npm test -- tests/backend.test.ts` passes.

## Expected deliverables

- Header policy/configuration, response tests, and deployment notes.

## How to set up and run tests

- `npm test -- tests/backend.test.ts`
- `npm run build`
- `npm run typecheck`

## Out of scope

- Changing authentication, CORS allowlists, or wallet signing behavior.

## Suggested labels

- `area: security`, `area: infrastructure`, `type: enhancement`, `difficulty: medium`.
