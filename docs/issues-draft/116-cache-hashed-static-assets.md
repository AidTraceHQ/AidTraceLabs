# Serve Hashed Static Assets With Long-Lived Cache Headers

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 1

## Problem statement

Vite emits content-hashed filenames for the built JavaScript and CSS bundles
(`vite.config.ts:15-21` sets `outDir: 'dist'` and `sourcemap: false`, so Vite uses its default
hashed asset names), but nothing tells the browser it may cache them.

- `vercel.json:1-8` contains only `framework`, `buildCommand`, `outputDirectory`, and two `rewrites`.
  There is no `headers` block.
- No Express middleware or static handler sets cache headers either: `server/app.ts:11-22` installs
  `x-powered-by` removal, `trust proxy`, CORS, rate limits, JSON parsing, routers, and the health check,
  and the only `Cache-Control` value in the API is `no-store` (`docs/api.md:3`, `server/app.ts:21`).

Result: every visit re-validates or re-downloads the immutable `index-<hash>.js` and
`index-<hash>.css`, and there is no explicit rule that `index.html` must stay uncached while hashed
assets may be cached forever.

Affected: repeat visitors on slow connections, and operators paying for bandwidth that a correct
`Cache-Control` policy avoids.

## Technical implementation requirements

- Add a `headers` block to `vercel.json` that applies `Cache-Control: public, max-age=31536000, immutable`
  to content-hashed build assets (for example `/assets/(.*)`) and explicitly prevents caching of
  `index.html` (`no-cache` or `max-age=0, must-revalidate`) so a new deployment is picked up.
- Match the asset path Vite actually emits: confirm from a `npm run build` output listing before
  writing the pattern; do not guess.
- Keep both existing `rewrites` (`vercel.json:5-8`) intact and in the same order.
- Do not change the API's `no-store` behaviour or add caching to any `/api/*` route.
- Do not introduce a service worker, a CDN configuration outside this repository, or change the
  build output directory.

## Files and areas to touch

- `vercel.json`
- `docs/deployment.md` (one paragraph describing the caching policy and why `index.html` is excluded)

## Dependencies

- Related to, but not overlapping, draft "Define Security Headers for API and Static Responses" (security response headers). "Define Security Headers for API and Static Responses" adds security headers to
  API and static responses in the same file; sequence this after "Define Security Headers for API and Static Responses" and keep their `headers` entries
  in the same block rather than creating a second conflicting block.

## Measurable acceptance criteria

- After `npm run build`, the emitted `dist/assets/*` filenames contain a content hash, and the
  configured pattern matches them.
- A deployed or locally replayed response for a hashed asset carries
  `Cache-Control: public, max-age=31536000, immutable`.
- The response for `/` (index.html) is not served with a long-lived cache policy.
- `vercel.json` parses and both rewrites remain.
- `npm run format:check` passes.

## Expected deliverables

- The `vercel.json` `headers` configuration and the deployment-doc paragraph.

## How to set up and run tests

- `npm ci && npm run build && ls dist/assets` to capture the real hashed filenames.
- Inspect the deployed response headers (or `vercel dev` locally) with
  `curl -I <deployed-url>/assets/<file>` and `curl -I <deployed-url>/`.
- Run `npm run format:check`.

## Out of scope

- API response caching, ETag/conditional requests for `/api/*`, service workers, code-splitting
  changes, and build-time compression.

## Suggested labels

- `area: infrastructure`, `type: enhancement`, `difficulty: medium`.
