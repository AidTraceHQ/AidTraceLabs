# Serve Hashed Static Assets With Long-Lived Cache Headers

**Complexity:** medium

## Context

Vite emits content-hashed filenames for the built JavaScript and CSS bundles (Vite default hashed asset names from `vite.config.ts`, which sets `outDir: 'dist'` at lines 15–21), but nothing tells the browser it may cache them. `vercel.json` (lines 1–8) contains only `framework`, `buildCommand`, `outputDirectory`, and two rewrites — no `headers` block. No Express middleware sets cache headers for static assets. Result: every visit re-validates or re-downloads immutable hashed assets, and there is no rule that `index.html` must stay uncached while hashed assets may be cached forever. Affected: repeat visitors on slow connections, and operators paying for avoidable bandwidth.

## Acceptance criteria

- After `npm run build`, the emitted `dist/assets/*` filenames contain a content hash, and the configured pattern matches them.
- A deployed or locally replayed response for a hashed asset carries `Cache-Control: public, max-age=31536000, immutable`.
- The response for `/` (index.html) is not served with a long-lived cache policy.
- `vercel.json` parses and both rewrites remain.
- `npm run format:check` passes.

## Files to touch

- `vercel.json`
- `docs/deployment.md` (one paragraph describing the caching policy and why `index.html` is excluded)

## Test expectations

- Run: `npm ci && npm run build && ls dist/assets` to capture the real hashed filenames.
- Inspect deployed response headers with `curl -I <deployed-url>/assets/<file>` and `curl -I <deployed-url>/`.
- Run: `npm run format:check`

## Out of scope

API response caching, ETag/conditional requests for `/api/*`, service workers, code-splitting changes, and build-time compression.

## Depends on

Define Security Headers for API and Static Responses
