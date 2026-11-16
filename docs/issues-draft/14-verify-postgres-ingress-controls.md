# Document and Verify PostgreSQL Network Restrictions

**Complexity:** medium

## Context

Deployment documentation lists database network restrictions as a required production operation, but the repository has no verified procedure or evidence for the hosted topology. Affected users: operators deploying to production who cannot determine what network controls are actually in place. Current behavior: restrictions are listed as required but never verified; no stable Vercel egress identity may be available for allowlisting. Expected behavior: the documentation accurately reflects what the selected hosting plan supports, with a runbook for the positive/negative connectivity check that uses redacted output and no URLs. Evidence: `docs/deployment.md` and `docs/security.md` (network restriction requirements listed without evidence).

## Acceptance criteria

- The documented check produces a successful `SELECT 1` on a permitted app connection and a rejected connection on a disallowed test connection, both recorded with redacted output and no URLs.
- The runbook matches the selected Vercel/Neon plan and does not assume unsupported fixed egress.
- The documented steps read or change no production data.
- If scripts change, `npm run typecheck` passes.

## Files to touch

- `docs/deployment.md`
- `docs/security.md`
- `scripts/` (only if a non-secret connectivity verification command is added)

## Test expectations

- Follow the documented connectivity check from an authorized environment.
- Run `npm run typecheck` if scripts change.
- No automated test harness; this is an operator runbook with redacted evidence.

## Out of scope

Changing Neon resources or network rules without an approved deployment operation.

## Depends on

Separate Runtime and Migration Database Roles
