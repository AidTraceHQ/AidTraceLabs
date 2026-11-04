# Deferred: TypeScript 7 major upgrade

**Complexity:** high

## Context

Dependabot opened PR #8 to bump `typescript` from `5.9.3` to `7.0.2` (semver-major). It was closed and deferred because CI fails before the build even starts. Dependabot now ignores semver-major updates for `typescript`, so this upgrade has to be done by hand as a planned change.

CI failure (run `41802967626`, step `npm ci`):

```
npm error code ERESOLVE
npm error While resolving: typescript-eslint@8.72.1
npm error Found: typescript@7.0.2
npm error Could not resolve dependency: peer typescript@">=4.8.4 <6.1.0" from typescript-eslint@8.72.1
```

The blocking issue is the peer range of `typescript-eslint` (and, transitively, the whole TypeScript plugin stack), not our own source. The upgrade needs a compatible tooling set rather than a version bump on its own.

## Acceptance criteria

- Identify a `typescript` major (and matching `typescript-eslint`, `@typescript-eslint/*`, and ESLint tooling) that resolves `npm ci` with no `ERESOLVE`.
- Keep `tsconfig.json`, `tsconfig.server.json`, and `tsconfig.test.json` compiling with the strict options already in use; only relax a rule if the migration genuinely requires it, and call it out in the PR.
- `npm run typecheck`, `npm run lint`, and `npm run build` pass on the pinned versions.
- Do not use `--force` or `--legacy-peer-deps` to paper over unresolved peers.

## Files to touch

- `package.json`
- `package-lock.json`
- `tsconfig.json`, `tsconfig.server.json`, `tsconfig.test.json` (only if required by the upgrade)
- `eslint.config.js` and the `typescript-eslint` dependency set

## Test expectations

- Run `npm run check` and confirm the full pipeline (typecheck, lint, format:check, test, smoke, build) is green.
- Confirm `npm ci` succeeds from a clean install with the committed lockfile.
- Note any new type errors that had to be fixed and why.
