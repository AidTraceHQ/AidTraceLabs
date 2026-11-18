# Assert Mainnet Horizon and Explorer Selection in Verification

**Complexity:** beginner

## Context

`horizonUrl` in `server/stellar-verification.ts` (lines 42Ã¢â‚¬â€œ58) selects the mainnet base URL when `record.network === 'mainnet'` and testnet otherwise. `explorerLink` (lines 143Ã¢â‚¬â€œ149) builds the `public` explorer link only for mainnet, and `recordSelect` in `server/records.ts` builds `verification_link` the same way (lines 248Ã¢â‚¬â€œ251). Every verification test uses `network: 'testnet'` in `tests/backend.test.ts` (lines 107, 162, 211), so the mainnet branches are never exercised and could regress silently. Affected: mainnet deployments whose endpoint selection or transaction links break without any test failing.

## Acceptance criteria

- New assertions (mocked `fetch`) pin that a `mainnet` record requests a URL whose host is the configured mainnet Horizon endpoint and that the produced `link` uses the `public` explorer path.
- The testnet case uses the testnet explorer path and host.
- Endpoint selection honors a configured `HORIZON_MAINNET_URL`/`HORIZON_TESTNET_URL` override without contacting the network.
- No test performs a live Horizon request.
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.

## Files to touch

- `tests/backend.test.ts` (and a small test helper under `tests/` if needed)

## Test expectations

- Set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty; Horizon tests use mocked `fetch`.
- Run: `npm test -- tests/backend.test.ts`
- Run: `npm run typecheck`

## Out of scope

Changing endpoint defaults, browser-side Horizon configuration, or the network-selection UI.

## Depends on

None
