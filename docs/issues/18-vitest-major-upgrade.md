# Deferred: Vitest 5 major upgrade

**Complexity:** high

## Context

The repository currently uses Vitest 4.1.12 with Vite 6. Dependabot PR #33 proposed Vitest 5.1.0
and was closed without merging. A major upgrade should be evaluated with the existing Vite,
React plugin, TypeScript, and Node toolchain together rather than enabling automatic major bumps.

## Acceptance criteria

- Confirm the selected Vitest release supports the repository's Vite and Node versions.
- Resolve the dependency tree with `npm ci` and the committed lockfile, without `--force` or
  `--legacy-peer-deps`.
- Keep `vitest.config.ts`, unit tests, API tests, and database guards working.
- Run `npm run check` and record any required configuration or test changes.

## Files to touch

- `package.json`
- `package-lock.json`
- `vitest.config.ts` only if required by the selected release
- Tests or Vite configuration only where compatibility requires it

## Test expectations

- Run `npm ci` from a clean dependency install.
- Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, and `npm run build`.
- Do not suppress peer dependency errors to force the upgrade through.
