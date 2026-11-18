# Use Configured Horizon Endpoints in Browser Activity

**Complexity:** intermediate

## Context

The API accepts configured Horizon URLs via environment variables, while browser account-activity fetches (account info, payments, transactions, event stream) always use hard-coded public Stellar Horizon hosts. Affected users: operators deploying to a private or staging Horizon instance. Current behavior: browser-side Horizon requests always target the public testnet/mainnet endpoints regardless of configuration. Expected behavior: a Vite-time configuration variable sets the browser Horizon endpoint, with safe testnet/mainnet defaults, validated as HTTPS base URLs, and no server-only secrets exposed. Evidence: `src/App.tsx` (account activity fetch calls) and `src/vite-env.d.ts` (declared Vite env types).

## Acceptance criteria

- A default build (`npm run build` with no `VITE_*` set) uses the public Stellar testnet/mainnet Horizon endpoints (asserted by test against captured request URLs).
- A test with a configured browser endpoint asserts the same URL is used for account, payment, transaction, and event-stream activity requests.
- A test asserts invalid or non-HTTPS production values fail validation and no `VITE_*` value contains a server-only secret.
- `npm test -- tests/environment.test.ts` passes.

## Files to touch

- `src/App.tsx`
- `src/vite-env.d.ts`
- `.env.example`
- `tests/` (Horizon configuration tests)
- `docs/deployment.md`

## Test expectations

- Run: `npm test -- tests/environment.test.ts`
- Run: `npm run typecheck`
- Run: `npm run build`

## Out of scope

Changing server verification logic or adding a new Horizon provider.

## Depends on

None
