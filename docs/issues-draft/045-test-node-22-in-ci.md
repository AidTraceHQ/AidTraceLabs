# Test the Hosted Node 22 Runtime in CI

**Complexity:** intermediate

## Context

CI installs and tests only on Node 20 in `.github/workflows/ci.yml` (lines 27Ã¢â‚¬â€œ31), while the hosted demo project is configured for Node 22 in `docs/demo-deployment.md` (lines 35Ã¢â‚¬â€œ43). The deployed major version is therefore not covered by the repository's automated checks. Affected users: maintainers who cannot detect Node 22 incompatibilities before deployment. Current behavior: CI only verifies Node 20; Node 22 is never tested. Expected behavior: a Node 22 CI run covers the same lockfile and supported checks (build, typecheck, test) while retaining Node 20 as the minimum-runtime check.

## Acceptance criteria

- CI shows successful required build/typecheck/test checks on Node 20 and Node 22.
- The Node 20 minimum remains enforced.
- No `--force` or `--legacy-peer-deps` install workaround is introduced.

## Files to touch

- `.github/workflows/ci.yml`
- `docs/deployment.md` (only if the supported runtime table needs alignment)

## Test expectations

- Locally install Node 22 and run: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Verify the resulting GitHub Actions matrix on the pull request.

## Out of scope

Raising the minimum Node version, changing package versions, or modifying Vercel project settings. This is not a TypeScript/Vite/Tailwind major upgrade (tracked by separate open issues).

## Depends on

None
