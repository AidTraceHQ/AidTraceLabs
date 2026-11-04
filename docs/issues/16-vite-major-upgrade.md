# Deferred: Vite 8 major upgrade

**Complexity:** high

## Context

Dependabot opened PR #7 to bump `vite` from `6.4.5` to `8.3.5` (semver-major). It was closed and deferred because CI fails during install. Dependabot now ignores semver-major updates for `vite`, so this upgrade has to be done by hand as a planned change.

CI failure (run `41802931701`, step `npm ci`):

```
npm error code ERESOLVE
npm error While resolving: @vitejs/plugin-react@4.7.0
npm error Found: vite@8.3.5
npm error Could not resolve dependency: peer vite@"^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0" from @vitejs/plugin-react@4.7.0
```

Vite 8 is outside the peer range of the pinned React plugin, so the plugin stack has to move together with Vite.

## Acceptance criteria

- Upgrade `vite` to a supported major together with a `@vitejs/plugin-react` release whose peer range includes it, so `npm ci` resolves with no `ERESOLVE`.
- Keep the dev server (`npm run dev:web`) and production build (`npm run build`) working with the existing `vite.config.ts` entry points.
- Keep `vitest.config.ts` and the test suite working; adjust the Vitest version only if the Vite major requires it.
- Do not use `--force` or `--legacy-peer-deps`.

## Files to touch

- `package.json`
- `package-lock.json`
- `vite.config.ts` (and `vitest.config.ts` if the Vite major forces a change)
- The `@vitejs/plugin-react` dependency

## Test expectations

- Run `npm run check` and confirm the full pipeline is green.
- Confirm `npm run build` produces the same output structure and `npm run smoke` still passes.
- Confirm `npm ci` succeeds from a clean install with the committed lockfile.
