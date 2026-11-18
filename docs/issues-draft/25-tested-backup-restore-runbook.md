# Document and Exercise Database Backup Restoration

**Complexity:** intermediate

## Context

Deployment docs list encrypted backups and tested restore procedures as required, but no restore procedure or exercise evidence is present in the repository. Affected users: operators and maintainers who need to recover from data loss or corruption. Current behavior: backup ownership, retention, access, recovery objectives, and restore steps are not documented. Expected behavior: a runbook documents the backup configuration, RPO/RTO targets, and restore steps for the selected provider, exercised into an isolated non-production branch. Verification uses migrations and the remote smoke check without exposing beneficiary data or credentials. Evidence: `docs/deployment.md` (backup requirements listed without procedures) and `docs/security.md`.

## Acceptance criteria

- A maintainer following the runbook restores an isolated database, after which `npm run db:migrate` and the remote smoke check succeed against the restored non-production target.
- The exercise record states a measured restore duration and success/failure outcome and prints no secrets or row contents.
- The runbook contains no destructive production restore step.

## Files to touch

- `docs/deployment.md`
- `docs/security.md`
- `scripts/` (only if a safe post-restore validation command is added)

## Test expectations

- Follow the documented isolated restore exercise.
- Run: `npm run db:migrate` against the restored non-production target.
- Run the remote smoke check against the restored non-production target.

## Out of scope

Running a restore against production or changing the production backup configuration without approval.

## Depends on

Separate Runtime and Migration Database Roles, Document and Verify PostgreSQL Network Restrictions
