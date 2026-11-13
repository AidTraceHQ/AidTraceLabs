# Use Configured Horizon Endpoints in Browser Activity

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 3

## Problem statement

The API accepts configured Horizon URLs, while browser account activity always uses hard-coded public Horizon hosts.

## Technical implementation requirements

- Add explicit public Vite configuration with safe testnet/mainnet defaults.
- Validate configured values as HTTPS base URLs and avoid exposing server-only settings/secrets.
- Use one source for account, payment, transaction, and event-stream activity requests.

## Files and areas to touch

- `src/App.tsx`
- `src/vite-env.d.ts`
- `.env.example`
- `tests/` (Horizon configuration tests)
- `docs/deployment.md`

## Dependencies

- None.

## Measurable acceptance criteria

- A default build (`npm run build` with no `VITE_*` set) asserts targets of the public Stellar testnet/mainnet Horizon endpoints.
- A test with a configured browser endpoint asserts the same URL is used for account, payment, transaction, and event-stream activity requests (captured request URLs match).
- A test asserts invalid or non-HTTPS production values fail validation and no `VITE_*` value contains a server-only secret.
- `npm test -- tests/environment.test.ts` passes.

## Expected deliverables

- Public endpoint configuration, validation, tests, and setup documentation.

## How to set up and run tests

- `npm test -- tests/environment.test.ts`
- `npm run typecheck`
- `npm run build`

## Out of scope

- Changing server verification logic or adding a new Horizon provider.

## Suggested labels

- `area: frontend`, `area: infrastructure`, `type: enhancement`, `difficulty: medium`.
