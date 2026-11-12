# Document and Exercise Database Backup Restoration

**Publish:** Day 3

**Size:** High

## Problem statement

Deployment docs list encrypted backups and tested restore procedures as required, but no restore procedure or exercise evidence is present.

## Technical requirements

- Document backup ownership, retention, access, recovery point/time objectives, and restore steps for the selected provider.
- Exercise restoration into an isolated branch/database using synthetic or approved demo data.
- Verify migrations, application health, and record counts without exposing beneficiary data or credentials.

## Files to touch

- `docs/deployment.md`
- `docs/security.md`
- `scripts/` only if a safe post-restore validation command is added

## Dependencies on other issues

- Coordinate with #13 for separate backup/migration/runtime identities and #14 for network access controls.

## Acceptance criteria

- A maintainer can follow the runbook to restore an isolated database and validate schema/health.
- The exercise records duration and success/failure evidence without printing secrets or row contents.
- The procedure explicitly avoids destructive production restore actions.

## Deliverables

- Provider-specific restore runbook and redacted isolated-restore exercise record.

## How to run tests

- Follow the documented isolated restore exercise; run `npm run db:migrate` and the remote smoke check against the restored non-production target.

## Out of scope

- Running a restore against production or changing the production backup configuration without approval.

## Suggested labels

- `area: infrastructure`, `area: security`, `type: documentation`, `difficulty: high`.
