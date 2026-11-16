# Cancel Superseded CI Runs With a Concurrency Group

**Complexity:** trivial

## Context

The CI workflow triggers on every pull request synchronization and every push to `main` (`.github/workflows/ci.yml`, lines 3–7) but defines no `concurrency` group (confirmed by reading the whole workflow, lines 1–58). Each new push to the same branch queues another full quality job while the previous one keeps running. Affected: contributors and maintainers who wait behind redundant runs and consume shared GitHub Actions minutes. Current behavior: every push queues an independent run; previous runs complete regardless. Expected behavior: a newer push on the same branch cancels the previous in-progress run; runs on the default branch are allowed to complete.

## Acceptance criteria

- Two quick consecutive pushes to the same branch cancel the first run and keep one run for the newest commit.
- Workflow YAML remains valid (`npx prettier --check .github/workflows/ci.yml` passes and the workflow is accepted on push).
- The `quality` job's steps, environment, and Postgres service are byte-for-byte unchanged.

## Files to touch

- `.github/workflows/ci.yml`

## Test expectations

- Run: `npx prettier --check .github/workflows/ci.yml`
- Verify: push two commits in quick succession to a scratch branch and confirm in the Actions tab that only the newer run completes.

## Out of scope

Adding path filters, changing triggers, caching, matrix builds, or any change to the `codeql.yml` workflow.

## Depends on

None
