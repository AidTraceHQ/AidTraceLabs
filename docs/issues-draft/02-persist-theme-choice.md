# Persist the Theme Choice

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 3 hours

**Release day:** Day 1

## Problem statement

The dark/light choice resets on reload, unlike the network preference which is persisted.

## Technical implementation requirements

- Store only the theme preference in browser storage.
- Follow the storage-unavailable fallback pattern used by `src/network-preference.ts`.

## Files and areas to touch

- `src/App.tsx`
- `src/theme-preference.ts`
- `tests/theme-preference.test.ts`

## Dependencies

- None.

## Measurable acceptance criteria

- `npx vitest run tests/theme-preference.test.ts` passes and asserts a stored theme is read back with the same value after a simulated reload.
- A test with an invalid stored value and a test with throwing/unavailable storage both assert the helper returns the default theme and the component still renders without throwing.

## Expected deliverables

- Theme preference helper, component integration, and storage/fallback tests.

## How to set up and run tests

- `npx vitest run tests/theme-preference.test.ts`
- `npm run typecheck`

## Out of scope

- System-theme detection, theme redesign, or broader accessibility work.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: trivial`.
