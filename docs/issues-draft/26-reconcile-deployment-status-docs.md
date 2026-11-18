# Reconcile General and Demo Deployment Status

**Complexity:** beginner

## Context

The general deployment guide says AidTrace has not been deployed, while the dedicated demo guide documents the live Vercel demo. Readers cannot tell whether "not deployed" means no production qualification or no hosted instance at all. Affected users: potential contributors, evaluators, and operators reading the docs. Current behavior: `docs/deployment.md` states the app has not been deployed; `docs/demo-deployment.md` documents a live demo. Expected behavior: the general guide accurately states that a hosted demo exists, distinguishes its limits from production qualification, and links to the demo guide. Evidence: `docs/deployment.md` and `docs/demo-deployment.md` (conflicting deployment status statements).

## Acceptance criteria

- `docs/deployment.md` states that a hosted demo exists and distinguishes its limits from production qualification, with no sentence implying production qualification.
- Service names and links agree across `docs/deployment.md` and `docs/demo-deployment.md`, and the general guide links to the demo guide.
- `npx prettier --check docs/deployment.md docs/demo-deployment.md` passes.
- No new unverified uptime, compliance, backup, or security claim is added.

## Files to touch

- `docs/deployment.md`
- `docs/demo-deployment.md`
- `README.md` (only if a link needs correction)

## Test expectations

- Run: `npx prettier --check docs/deployment.md docs/demo-deployment.md`
- Verify every hosted-service claim against the current deployment before publishing.

## Out of scope

Changing the live demo, deployment settings, credentials, or production infrastructure.

## Depends on

None
