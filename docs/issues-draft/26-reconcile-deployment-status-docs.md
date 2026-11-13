# Reconcile General and Demo Deployment Status

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 4 hours

**Release day:** Private later backlog

## Problem statement

The general deployment guide says AidTrace has not been deployed, while the dedicated demo guide documents the live Vercel demo. Readers cannot tell whether “not deployed” means no production qualification or no hosted instance at all.

## Technical implementation requirements

- Distinguish the live demo from production qualification and unverified operational controls.
- Link the general deployment guide to the dedicated demo guide.
- Keep statements tied to the latest verification date and avoid implying the demo is production-qualified.

## Files and areas to touch

- `docs/deployment.md`
- `docs/demo-deployment.md`
- `README.md` only if a link needs correction

## Dependencies

- None.

## Measurable acceptance criteria

- `docs/deployment.md` states that a hosted demo exists and distinguishes its limits from production qualification, with no sentence implying production qualification.
- Service names and links agree across `docs/deployment.md` and `docs/demo-deployment.md`, and the general guide links to the demo guide.
- `npx prettier --check docs/deployment.md docs/demo-deployment.md` passes and no new unverified uptime, compliance, backup, or security claim is added.

## Expected deliverables

- Corrected deployment status text and cross-links.

## How to set up and run tests

- `npx prettier --check docs/deployment.md docs/demo-deployment.md`
- Verify every hosted-service claim against the current deployment before publishing.

## Out of scope

- Changing the live demo, deployment settings, credentials, or production infrastructure.

## Suggested labels

- `area: docs`, `type: documentation`, `difficulty: medium`.
