# Reconcile General and Demo Deployment Status

**Publish:** Private later backlog

**Size:** Medium

## Problem statement

The general deployment guide says AidTrace has not been deployed, while the dedicated demo guide documents the live Vercel demo. Readers cannot tell whether “not deployed” means no production qualification or no hosted instance at all.

## Technical requirements

- Distinguish the live demo from production qualification and unverified operational controls.
- Link the general deployment guide to the dedicated demo guide.
- Keep statements tied to the latest verification date and avoid implying the demo is production-qualified.

## Files to touch

- `docs/deployment.md`
- `docs/demo-deployment.md`
- `README.md` only if a link needs correction

## Dependencies on other issues

- None.

## Acceptance criteria

- The general guide accurately states that a hosted demo exists while distinguishing its limits from production qualification.
- Links and service names agree across both guides.
- No unverified uptime, compliance, backup, or security claims are introduced.

## Deliverables

- Corrected deployment status text and cross-links.

## How to run tests

- `npx prettier --check docs/deployment.md docs/demo-deployment.md`
- Verify every hosted-service claim against the current deployment before publishing.

## Out of scope

- Changing the live demo, deployment settings, credentials, or production infrastructure.

## Suggested labels

- `area: docs`, `type: documentation`, `difficulty: medium`.
