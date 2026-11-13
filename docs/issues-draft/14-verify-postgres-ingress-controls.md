# Document and Verify PostgreSQL Network Restrictions

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 1

## Problem statement

Deployment documentation lists database network restrictions as a required production operation, but the repository has no verified procedure/evidence for the hosted topology.

## Technical implementation requirements

- Identify the actual hosting plan's supported private-connectivity or allowlist options before prescribing addresses.
- Document the selected restriction, safe operator steps, and a positive/negative connectivity verification.
- State limitations if the current plan cannot provide a stable Vercel egress identity.

## Files and areas to touch

- `docs/deployment.md`
- `docs/security.md`
- `scripts/` only if a non-secret connectivity verification command is added

## Dependencies

- Coordinate with "Separate Runtime and Migration Database Roles" so the documented rules apply to runtime and migration identities separately.

## Measurable acceptance criteria

- The documented check produces a successful `SELECT 1` on a permitted app connection and a rejected connection on a disallowed test connection, both recorded with redacted output and no URLs.
- The runbook matches the selected Vercel/Neon plan and does not assume unsupported fixed egress.
- The documented steps read or change no production data.
- If scripts change, `npm run typecheck` passes.

## Expected deliverables

- Plan-specific network restriction runbook and redacted verification evidence.

## How to set up and run tests

- Follow the documented connectivity check from an authorized environment; run `npm run typecheck` if scripts change.

## Out of scope

- Changing Neon resources or network rules without an approved deployment operation.

## Suggested labels

- `area: infrastructure`, `area: security`, `type: documentation`, `difficulty: medium`.
