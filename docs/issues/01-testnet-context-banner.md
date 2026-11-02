# Testnet Context Banner

**Complexity:** trivial

## Context

Testnet is the development default, and the UI also permits mainnet selection. Make the active network context obvious so a reviewer does not mistake test data for production activity.

## Acceptance criteria

- Display a persistent, accessible environment indicator when testnet is selected.
- Update the indicator immediately when the selected network changes.
- Do not describe testnet activity as real aid disbursement.

## Files to touch

- `src/App.tsx`
- `src/fullstack.css`
- `tests/network-preference.test.ts`

## Test expectations

- Cover testnet and mainnet label/state transitions.
- Verify the indicator has accessible text and does not change record data.
- Run `npm run check`.
