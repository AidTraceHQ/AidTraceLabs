# Default New Records to the Selected Network

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 2 hours

**Release day:** Day 1

## Problem statement

The record form copies the top-level `network` state only when the component mounts (`src/App.tsx:241-255`). Changing the top-level selector later does not update `form.network`, so a new record can start with a different network than the selected app context.

## Technical implementation requirements

- Initialize the form from the selected network whenever a new record form opens.
- If the app network changes while the form is open, update the form default only until the user explicitly chooses a form network.
- Preserve the explicit per-record network selector and server validation.

## Files and areas to touch

- `src/App.tsx`
- `tests/` (focused form-state test if a component test harness exists)

## Dependencies

- None. This is not the testnet context banner in #11 or endpoint configuration in prior draft #18.

## Measurable acceptance criteria

- Opening a new record after changing the top-level network preselects that network.
- Manual form-level network selection is not overwritten by unrelated rerenders.
- A saved record still uses the explicit network value submitted in the form.

## Expected deliverables

- Form default synchronization and a focused state regression check.

## How to set up and run tests

- Run the focused frontend test if available; otherwise verify the network-switch/form sequence in the browser.
- Run `npm run typecheck`.

## Out of scope

- Changing server verification logic or automatically changing the selected wallet network.

## Suggested labels

- `area: frontend`, `type: bug`, `difficulty: trivial`.
