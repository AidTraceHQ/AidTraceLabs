# Default New Records to the Selected Network

**Complexity:** beginner

## Context

The record form's `form` `useState` initializer in `src/App.tsx` (lines 241Ã¢â‚¬â€œ255) seeds its `network` field from top-level `network` state only when the component mounts. Changing the top-level selector later does not update `form.network`, so a new record can start with a different network than the selected app context. Affected users: organization users creating records after switching networks in the same session. Current behavior: `form.network` reflects the network at mount time; subsequent top-level network changes are ignored. Expected behavior: opening a new record form always initializes `network` from the current selected network; if the app network changes while the form is open and the user has not explicitly chosen a form network, the default updates. The explicit per-record network selector and server validation are preserved. Evidence: `src/App.tsx` (form `useState` initializer, lines 241Ã¢â‚¬â€œ255).

## Acceptance criteria

- After switching the top-level selector to mainnet, opening the record form shows the Network field as mainnet (asserted by a focused form-state test if a harness exists, or documented in `docs/manual-test-checklist.md`).
- Changing the form Network to testnet and then triggering an unrelated re-render leaves the field at testnet.
- A saved record's `network` equals the value shown in the form at submit time.
- `npm run typecheck` passes.

## Files to touch

- `src/App.tsx`
- `tests/` (focused form-state test if a component test harness exists)

## Test expectations

- Run the focused frontend test if available.
- Run: `npm run typecheck`
- Manual check: switch network, open form, verify Network field.

## Out of scope

Changing server verification logic or automatically changing the selected wallet network.

## Depends on

None
