# Add a Favicon and Declare the Supported Color Scheme

**Complexity:** beginner

## Context

The document head in `index.html` (lines 1Ã¢â‚¬â€œ12) declares a title, description, viewport, and `theme-color` but no icon link and no `color-scheme` hint. Two issues follow: the browser requests `/favicon.ico` on every load and the path is not served (no `public/` directory is tracked), so the tab shows a blank icon and the request returns 404. Additionally, the app supports a dark theme through `.app.dark` CSS variables in `src/index.css` (lines 55Ã¢â‚¬â€œ62) but never advertises a supported color scheme, so form controls, scrollbars, and browser UI stay light even in dark mode. Affected: every visitor (branding polish) and dark-theme users on browsers that theme native widgets from `color-scheme`.

## Acceptance criteria

- `npm run build` emits the favicon into `dist/` and `dist/index.html` contains the `rel="icon"` link.
- Loading the built site produces no `404` request for `/favicon.ico`.
- The document head contains `<meta name="color-scheme" content="light dark">`.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` pass.

## Files to touch

- `index.html`
- A new `public/favicon.svg`
- `docs/manual-test-checklist.md` (one checklist line)

## Test expectations

- Run: `npm ci && npm run build`
- Serve the build (`npm run preview`) and confirm the tab icon appears and the network panel shows no `404` for the icon request.
- Run: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`

## Out of scope

PWA manifest, offline caching, app icons for mobile home screens, per-route icons, and any change to the light/dark palette.

## Depends on

None
