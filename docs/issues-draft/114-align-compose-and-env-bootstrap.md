# Make Docker Compose and the `.env` Bootstrap Agree

**Complexity:** medium

## Context

The documented local bootstrap and Docker Compose disagree about which environment file exists, so `docker compose up` fails for a contributor who followed the written steps. `CONTRIBUTING.md` (line 9) tells contributors to run `npm run setup:env`, which copies `.env.example` to `.env.local` (in `scripts/setup-env.ts`, lines 7–8 and 15–16). The `api` service in `docker-compose.yml` (line 20) asks Compose for `.env`. `.env` and `.env.*` are both gitignored except `.env.example` (`.gitignore`, lines 4–6), so no committed file satisfies the Compose reference. `docs/deployment.md` (line 9) states Compose "has not been run or verified", consistent with a configuration that cannot be started from a clean checkout. Affected: every contributor trying the documented container path.

## Acceptance criteria

- On a clean checkout, `npm ci && npm run setup:env && docker compose up` reaches a running `api` container that logs the applied-migration line, without manually creating a second env file.
- `git status` stays clean after `setup:env` (the generated file is ignored).
- `grep` for the env filename shows one consistent convention across `docker-compose.yml`, `scripts/setup-env.ts`, and `CONTRIBUTING.md`.
- `npm run typecheck`, `npm run lint`, and `npm run format:check` pass.
- If Docker is unavailable where the change is made, the pull request says so and documents the exact command a reviewer should run.

## Files to touch

- `docker-compose.yml`
- `scripts/setup-env.ts`
- `CONTRIBUTING.md`
- `docs/deployment.md`
- `package.json` (only if the script name/behavior message changes)

## Test expectations

- Run: `npm ci && npm run setup:env` and confirm the generated filename.
- Run: `docker compose up` (or `docker compose config` if Docker is unavailable, to confirm Compose resolves the env file without error).
- Run: `npm run typecheck`, `npm run lint`, `npm run format:check`

## Out of scope

Docker image optimization, adding new services, production container hardening, and changing the migration command itself.

## Depends on

None
