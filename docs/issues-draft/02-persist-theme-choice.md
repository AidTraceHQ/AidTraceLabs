# Persist the Theme Choice

**Publish:** Day 1

**Size:** Trivial

## Problem statement

The dark/light choice resets on reload, unlike the network preference which is persisted.

## Technical requirements

- Store only the theme preference in browser storage.
- Follow the storage-unavailable fallback pattern used by `src/network-preference.ts`.

## Files to touch

- `src/App.tsx`
- `src/theme-preference.ts`
- `tests/theme-preference.test.ts`

## Dependencies on other issues

- None.

## Acceptance criteria

- A selected theme survives reload.
- Invalid stored values and unavailable storage fall back safely without breaking render.

## Deliverables

- Theme preference helper, component integration, and storage/fallback tests.

## How to run tests

- `npx vitest run tests/theme-preference.test.ts`
- `npm run typecheck`

## Out of scope

- System-theme detection, theme redesign, or broader accessibility work.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: trivial`.
