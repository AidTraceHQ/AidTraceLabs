# Define Security Headers for API and Static Responses

**Publish:** Day 3

**Size:** Medium

## Problem statement

The API disables `x-powered-by`, but there is no deliberate browser security-header policy in Express or Vercel configuration.

## Technical requirements

- Select and document compatible values for content type sniffing, framing, referrer, permissions, and transport security.
- Configure static Vercel responses and API responses consistently where appropriate.
- Test that wallet/Freighter flows and required external Horizon/explorer links continue to work.

## Files to touch

- `server/app.ts`
- `vercel.json`
- `tests/backend.test.ts`
- `docs/deployment.md`

## Dependencies on other issues

- None.

## Acceptance criteria

- Expected headers are present on the frontend and API responses.
- A CSP, if introduced, permits only documented required sources and does not use a broad wildcard.
- Local and Vercel route behavior remains intact.

## Deliverables

- Header policy/configuration, response tests, and deployment notes.

## How to run tests

- `npm test -- tests/backend.test.ts`
- `npm run build`
- `npm run typecheck`

## Out of scope

- Changing authentication, CORS allowlists, or wallet signing behavior.

## Suggested labels

- `area: security`, `area: infrastructure`, `type: enhancement`, `difficulty: medium`.
