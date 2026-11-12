# Document and Verify PostgreSQL Network Restrictions

**Publish:** Day 1

**Size:** High

## Problem statement

Deployment documentation lists database network restrictions as a required production operation, but the repository has no verified procedure/evidence for the hosted topology.

## Technical requirements

- Identify the actual hosting plan's supported private-connectivity or allowlist options before prescribing addresses.
- Document the selected restriction, safe operator steps, and a positive/negative connectivity verification.
- State limitations if the current plan cannot provide a stable Vercel egress identity.

## Files to touch

- `docs/deployment.md`
- `docs/security.md`
- `scripts/` only if a non-secret connectivity verification command is added

## Dependencies on other issues

- Coordinate with #13 so the documented rules apply to runtime and migration identities separately.

## Acceptance criteria

- The runbook matches the selected Vercel/Neon plan and does not assume unsupported fixed egress.
- A permitted app connection and a disallowed test connection are both verified without exposing URLs.
- No production data is read or changed during the check.

## Deliverables

- Plan-specific network restriction runbook and redacted verification evidence.

## How to run tests

- Follow the documented connectivity check from an authorized environment; run `npm run typecheck` if scripts change.

## Out of scope

- Changing Neon resources or network rules without an approved deployment operation.

## Suggested labels

- `area: infrastructure`, `area: security`, `type: documentation`, `difficulty: high`.
