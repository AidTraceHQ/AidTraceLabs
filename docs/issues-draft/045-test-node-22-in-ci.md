# Test the Hosted Node 22 Runtime in CI

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 5

## Problem statement

CI installs and tests only on Node 20 (`.github/workflows/ci.yml:27-31`), while the hosted demo project is configured for Node 22 (`docs/demo-deployment.md:35-43`). The deployed major version is therefore not covered by the repository's automated checks.

## Technical implementation requirements

- Add a Node 22 CI run for the same lockfile and supported checks, while retaining Node 20 as the minimum-runtime check.
- Avoid multiplying the database-backed integration job if a build/typecheck/test split can validate Node 22 with lower CI cost.
- Keep lockfile installation deterministic with `npm ci` and report each runtime separately.

## Files and areas to touch

- `.github/workflows/ci.yml`
- `docs/deployment.md` only if the supported runtime table needs alignment

## Dependencies

- None. This is runtime compatibility coverage, not a TypeScript/Vite/Tailwind major upgrade (#25-27).

## Measurable acceptance criteria

- CI shows successful required build/typecheck/test checks on Node 20 and Node 22.
- The Node 20 minimum remains enforced.
- No `--force` or `--legacy-peer-deps` install workaround is introduced.

## Expected deliverables

- Node 22 workflow coverage with clear check names and updated runtime support notes if needed.

## How to set up and run tests

- Locally install/use Node 22 and run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
- Verify the resulting GitHub Actions matrix on the pull request.

## Out of scope

- Raising the minimum Node version, changing package versions, or modifying Vercel project settings.

## Suggested labels

- `area: infrastructure`, `area: testing`, `type: enhancement`, `difficulty: medium`.
