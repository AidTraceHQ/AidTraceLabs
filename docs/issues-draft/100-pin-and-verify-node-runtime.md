# Pin and verify the Node runtime

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Day 3

## Problem statement

The supported Node version is not declared anywhere. `package.json` has no `engines` field
(`package.json:1-68`), there is no `.nvmrc`, CI runs Node 20 (`.github/workflows/ci.yml:47`) while the
hosted demo project is configured for Node 22 (`docs/demo-deployment.md:35-43`), and `@types/node` is
pinned to `^20` (`package.json:44`). Contributors can therefore install on a version the project does
not test, and nothing fails until a runtime difference appears. Affected: contributors and CI
reliability. This is a declarative pin only — it must not upgrade any dependency or the runtime.

## Technical implementation requirements

- Add an `engines.node` range to `package.json` matching what CI and the deployment target support,
  and add a matching `.nvmrc`.
- Add a CI step (or extend the existing quality job) that fails when the running Node major is outside
  the declared range, so drift is caught early.
- Keep the current CI Node version and the existing steps unchanged unless a change is required to
  make the guard pass.
- Do not upgrade `@types/node`, any dependency, or the hosted runtime here — a major upgrade needs its
  own spec.

## Files and areas to touch

- `package.json`
- `.nvmrc` (new)
- `.github/workflows/ci.yml`
- `docs/deployment.md` (one line on the supported version)

## Dependencies

- Adjacent to the "test the declared Vercel Node 22 runtime in CI" draft ("Test the Hosted Node 22 Runtime in CI"); that draft adds a 22
  matrix entry, this one declares and enforces the supported range. They can land in either order.

## Measurable acceptance criteria

- `package.json` declares `engines.node` and `.nvmrc` matches it.
- CI fails with a clear message when run on a Node major outside the range and passes on a supported
  one.
- `npm run check` still passes on the pinned version.

## Expected deliverables

- Declared runtime range, `.nvmrc`, a CI guard, and a deployment-doc note.

## How to set up and run tests

- Run the CI guard locally with a supported Node version and confirm it passes.
- Run `npm run check`.

## Out of scope

- Upgrading the runtime or any dependency, adding a full Node version matrix, and Docker image changes.

## Suggested labels

- `area: infrastructure`, `area: testing`, `type: enhancement`, `difficulty: medium`
