# Persist the Theme Choice

**Complexity:** trivial

## Context

The dark/light theme choice resets on page reload, unlike the network preference which is persisted via `src/network-preference.ts`. Affected users: any user who prefers dark mode and must re-select it after every reload. Current behavior: theme is held in component state only. Expected behavior: the chosen theme survives a page reload. Evidence: `src/App.tsx` (theme `useState` initialization) and `src/network-preference.ts` (the pattern to follow for browser-storage with an unavailability fallback).

## Acceptance criteria

- `npx vitest run tests/theme-preference.test.ts` passes and asserts a stored theme is read back with the same value after a simulated reload.
- A test with an invalid stored value asserts the helper returns the default theme and the component renders without throwing.
- A test with throwing or unavailable storage asserts the helper returns the default theme without throwing.

## Files to touch

- `src/App.tsx`
- `src/theme-preference.ts`
- `tests/theme-preference.test.ts`

## Test expectations

- Run: `npx vitest run tests/theme-preference.test.ts`
- Run: `npm run typecheck`
- No database setup required.

## Out of scope

System-theme detection, theme redesign, or broader accessibility work.

## Depends on

None
