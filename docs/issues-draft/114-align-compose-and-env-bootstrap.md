# Make Docker Compose and the `.env` Bootstrap Agree

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 5

## Problem statement

The documented local bootstrap and Docker Compose disagree about which environment file exists, so
`docker compose up` fails for a contributor who followed the written steps.

- `CONTRIBUTING.md:9` tells contributors to run `npm run setup:env`, and the script copies
  `.env.example` to **`.env.local`** (`scripts/setup-env.ts:7-8, 15-16`).
- The `api` service asks Compose for **`.env`** (`docker-compose.yml:20`), and the API command runs
  `npm run db:migrate && npm run start:server` inside the container (`docker-compose.yml:25`).
- `.env` and `.env.*` are both gitignored except `.env.example` (`.gitignore:4-6`), so no committed
  file satisfies the Compose reference.
- `docs/deployment.md:9` states Compose "has not been run or verified", which is consistent with a
  configuration that cannot be started from a clean checkout.

Affected: every contributor who tries the documented container path, and maintainers fielding reports
that the API container exits (or starts without `SESSION_SECRET`) because Compose could not read the
generated file.

## Technical implementation requirements

- Make one bootstrap produce the file Compose actually reads: either have `setup:env` create `.env`
  (and keep it gitignored) or point `docker-compose.yml` at `.env.local` via `env_file`. Pick one and
  make the docs, script, and compose file agree; do not add a second parallel convention.
- Keep secrets out of source control: `.env`/`.env.local` must stay ignored, and `.env.example`
  remains the only tracked template (`.gitignore:4-6`).
- Do not weaken the existing test-database safety guards in `tests/setup.ts` or add production
  defaults.
- Do not change the `web` service's `API_PROXY_TARGET` (`docker-compose.yml:35`) or the Postgres
  service definition.
- If Compose genuinely cannot be verified in the development environment, state that explicitly in the
  issue comment and in `docs/deployment.md` rather than claiming verification.

## Files and areas to touch

- `docker-compose.yml`
- `scripts/setup-env.ts`
- `CONTRIBUTING.md`
- `docs/deployment.md`
- `package.json` only if the script name/behaviour message changes

## Dependencies

- None. Distinct from draft "Reconcile General and Demo Deployment Status" (reconcile deployment status text) and draft "Pin and verify the Node runtime" (Node runtime);
  neither changes which env file Compose reads.

## Measurable acceptance criteria

- On a clean checkout, `npm ci && npm run setup:env && docker compose up` reaches a running `api`
  container that logs the applied-migration line, without manually creating a second env file.
- `git status` stays clean after `setup:env` (the generated file is ignored).
- `grep` for the env filename shows one consistent convention across `docker-compose.yml`,
  `scripts/setup-env.ts`, and `CONTRIBUTING.md`.
- `npm run typecheck`, `npm run lint`, and `npm run format:check` pass.
- If Docker is unavailable where the change is made, the pull request says so and documents the exact
  command a reviewer should run.

## Expected deliverables

- The aligned compose/script/docs change and a short "container workflow" note in
  `docs/deployment.md`.

## How to set up and run tests

- `npm ci`; `npm run setup:env`; confirm the generated filename.
- `docker compose up` (or `docker compose config` if Docker is unavailable, to confirm Compose resolves
  the env file without error).
- `npm run typecheck`, `npm run lint`, `npm run format:check`.

## Out of scope

- Docker image optimisation, adding new services, production container hardening, and changing the
  migration command itself.

## Suggested labels

- `area: infrastructure`, `area: docs`, `type: bug`, `difficulty: medium`.
