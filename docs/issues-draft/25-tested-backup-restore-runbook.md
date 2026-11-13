# Document and Exercise Database Backup Restoration

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 8 hours

**Release day:** Day 3

## Problem statement

Deployment docs list encrypted backups and tested restore procedures as required, but no restore procedure or exercise evidence is present.

## Technical implementation requirements

- Document backup ownership, retention, access, recovery point/time objectives, and restore steps for the selected provider.
- Exercise restoration into an isolated branch/database using synthetic or approved demo data.
- Verify migrations, application health, and record counts without exposing beneficiary data or credentials.

## Files and areas to touch

- `docs/deployment.md`
- `docs/security.md`
- `scripts/` only if a safe post-restore validation command is added

## Dependencies

- Coordinate with "Separate Runtime and Migration Database Roles" for separate backup/migration/runtime identities and "Document and Verify PostgreSQL Network Restrictions" for network access controls.

## Measurable acceptance criteria

- A maintainer following the runbook restores an isolated database, after which `npm run db:migrate` and the remote smoke check succeed against the restored non-production target.
- The exercise record states a measured restore duration and success/failure outcome and prints no secrets or row contents.
- The runbook contains no destructive production restore step.

## Expected deliverables

- Provider-specific restore runbook and redacted isolated-restore exercise record.

## How to set up and run tests

- Follow the documented isolated restore exercise; run `npm run db:migrate` and the remote smoke check against the restored non-production target.

## Out of scope

- Running a restore against production or changing the production backup configuration without approval.

## Suggested labels

- `area: infrastructure`, `area: security`, `type: documentation`, `difficulty: medium`.
