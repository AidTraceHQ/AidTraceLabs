# Pin and Verify the Node Runtime

**Complexity:** medium

## Context

The supported Node version is not declared anywhere. `package.json` has no `engines` field (lines 1–68), there is no `.nvmrc`, CI runs Node 20 (`.github/workflows/ci.yml`, line 47) while the hosted demo project is configured for Node 22 (`docs/demo-deployment.md`, lines 35–43), and `@types/node` is pinned to `^20` (`package.json`, line 44). Contributors can install on an untested version and nothing fails until a runtime difference appears. This is a declarative pin only — it must not upgrade any dependency or the runtime. Affected: contributors and CI reliability.

## Acceptance criteria

- `package.json` declares `engines.node` and `.nvmrc` matches it.
- CI fails with a clear message when run on a Node major outside the range and passes on a supported one.
- `npm run check` still passes on the pinned version.

## Files to touch

- `package.json`
- `.nvmrc` (new)
- `.github/workflows/ci.yml`
- `docs/deployment.md` (one line on the supported version)

## Test expectations

- Run the CI guard locally with a supported Node version and confirm it passes.
- Run: `npm run check`

## Out of scope

Upgrading the runtime or any dependency, adding a full Node version matrix, and Docker image changes.

## Depends on

None
