# Assert Mainnet Horizon and Explorer Selection in Verification

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 3 hours

**Release day:** Day 4

## Problem statement

`horizonUrl` selects the mainnet base URL when `record.network === 'mainnet'` and the testnet URL otherwise (`server/stellar-verification.ts:42-58`), and `explorerLink` builds the `public` explorer link only for mainnet (`server/stellar-verification.ts:143-149`); `recordSelect` builds `verification_link` the same way (`server/records.ts:248-251`). Every verification test uses `network: 'testnet' as const` (`tests/backend.test.ts:107`, `tests/backend.test.ts:162`, `tests/backend.test.ts:211`), so the mainnet branches are never exercised and could regress silently. Affected: mainnet deployments whose endpoint selection or transaction links break without any test failing.

## Technical implementation requirements

- Add focused assertions (mocked `fetch`) that a `mainnet` record requests a URL whose host is the configured mainnet Horizon endpoint and that the produced `link` uses the `public` explorer path.
- Assert the testnet case uses the testnet explorer path and host.
- Assert endpoint selection honours a configured `HORIZON_MAINNET_URL`/`HORIZON_TESTNET_URL` override without contacting the network.
- Do NOT change production verification logic, add a dependency, or assert on live network content.

## Files and areas to touch

- `tests/backend.test.ts` (and a small test helper under `tests/` if needed)

## Dependencies

- None. Distinct from "Lock Down Horizon Failure-State Contracts" (failure-state contract) and from draft "Use Configured Horizon Endpoints in Browser Activity" (browser endpoint configuration).

## Measurable acceptance criteria

- New assertions pin the mainnet/testnet Horizon URL host and the mainnet/testnet explorer path.
- No test performs a live Horizon request (mocked `fetch` only).
- `npm test -- tests/backend.test.ts` and `npm run typecheck` pass.

## Expected deliverables

- Focused mainnet/testnet endpoint-and-link assertions added to the existing verification suite.

## How to set up and run tests

- To skip database integration locally, set `TEST_DATABASE_URL` and `TEST_DATABASE_URL_UNPOOLED` empty in the shell, then run `npm test -- tests/backend.test.ts`; the Horizon tests use a mocked `fetch`.
- Run `npm run typecheck`.

## Out of scope

- Changing endpoint defaults, browser-side Horizon configuration, or the network-selection UI.

## Suggested labels

- `area: backend`, `area: testing`, `type: enhancement`, `difficulty: trivial`.
