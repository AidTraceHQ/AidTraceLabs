# Cancel Superseded CI Runs With a Concurrency Group

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 2 hours

**Release day:** Day 5

## Problem statement

The CI workflow triggers on every pull request synchronisation and every push to `main`
(`.github/workflows/ci.yml:3-7`) but defines no `concurrency` group (confirmed by reading the whole
workflow, `.github/workflows/ci.yml:1-58`). Each new push to the same branch therefore queues another
full quality job — `npm ci`, typecheck, lint, format check, build, the PostgreSQL-backed test suite,
smoke test, and `npm audit` (`ci.yml:49-58`) — while the previous one keeps running to completion.

Affected: contributors and maintainers, who wait behind redundant runs and consume shared GitHub
Actions minutes and the CI PostgreSQL service for results that are already obsolete.

## Technical implementation requirements

- Add a workflow-level `concurrency` block with a group keyed to the workflow name plus the ref, for
  example `group: ${{ github.workflow }}-${{ github.ref }}`.
- Set `cancel-in-progress: true`.
- Do not cancel runs on the default branch in a way that hides a required check: gate the cancellation
  so pushes to `main` are still allowed to complete, or restrict cancellation to pull requests.
- Do not change any job, step, `permissions` block, service container, or environment variable
  (`ci.yml:9-42`).
- Do not touch `.github/workflows/codeql.yml`.

## Files and areas to touch

- `.github/workflows/ci.yml`

## Dependencies

- None. Unrelated to draft "Pin and verify the Node runtime" (Node runtime declaration) and draft "Test the Hosted Node 22 Runtime in CI" (Node 22 CI job), which
  change job content, not workflow scheduling.

## Measurable acceptance criteria

- Two quick consecutive pushes to the same branch cancel the first run and keep one run for the newest
  commit.
- Workflow YAML remains valid (`npx prettier --check .github/workflows/ci.yml` passes and the workflow
  is accepted on push).
- The `quality` job's steps, environment, and Postgres service are byte-for-byte unchanged.

## Expected deliverables

- The `concurrency` configuration and a one-line note in `CONTRIBUTING.md` or the PR description
  explaining that superseded runs are cancelled.

## How to set up and run tests

- `npx prettier --check .github/workflows/ci.yml`
- Push two commits in quick succession to a scratch branch and confirm in the Actions tab that only the
  newer run completes.

## Out of scope

- Adding path filters, changing triggers, caching, matrix builds, or any change to the `codeql.yml`
  workflow.

## Suggested labels

- `area: infrastructure`, `type: enhancement`, `difficulty: trivial`.
