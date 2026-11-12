# Use Configured Horizon Endpoints in Browser Activity

**Publish:** Day 3

**Size:** Medium

## Problem statement

The API accepts configured Horizon URLs, while browser account activity always uses hard-coded public Horizon hosts.

## Technical requirements

- Add explicit public Vite configuration with safe testnet/mainnet defaults.
- Validate configured values as HTTPS base URLs and avoid exposing server-only settings/secrets.
- Use one source for account, payment, transaction, and event-stream activity requests.

## Files to touch

- `src/App.tsx`
- `src/vite-env.d.ts`
- `.env.example`
- `tests/` (Horizon configuration tests)
- `docs/deployment.md`

## Dependencies on other issues

- None.

## Acceptance criteria

- Default builds still target the public Stellar testnet/mainnet Horizon endpoints.
- A configured browser endpoint is used consistently for activity and event streaming.
- Invalid or non-HTTPS production values fail safely and no secret is placed in `VITE_*`.

## Deliverables

- Public endpoint configuration, validation, tests, and setup documentation.

## How to run tests

- `npm test -- tests/environment.test.ts`
- `npm run typecheck`
- `npm run build`

## Out of scope

- Changing server verification logic or adding a new Horizon provider.

## Suggested labels

- `area: frontend`, `area: infrastructure`, `type: enhancement`, `difficulty: medium`.
