# Add a Favicon and Declare the Supported Color Scheme

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 2 hours

**Release day:** Day 3

## Problem statement

The document head declares a title, description, viewport, and `theme-color` but no icon link and no
`color-scheme` hint (`index.html:1-12`). Two consequences are visible today:

- The browser requests `/favicon.ico` on every load. Nothing in the repository serves that path
  and no `<link rel="icon">` exists anywhere (`index.html:1-16`; no `public/` directory is tracked), so
  the tab, bookmark, and history entries show a blank/default icon and the request returns `404`.
- The app supports a dark theme through the `.app.dark` class and its CSS variables
  (`src/index.css:55-62`), but the document never advertises a supported color scheme. Form controls,
  scrollbars, and the browser's own UI stay light in the dark theme because the user agent has no
  `color-scheme` signal.

Affected: every visitor (branding and perceived polish) and dark-theme users on browsers that theme
native widgets from `color-scheme`.

## Technical implementation requirements

- Add an SVG favicon file and reference it from `index.html` with `<link rel="icon" type="image/svg+xml" href="./favicon.svg">`.
  Use a relative path (the build sets `base: './'` in `vite.config.ts:6`) and place the asset where Vite
  copies it to `dist/` unchanged.
- Keep the existing `theme-color` meta tag; do not remove it.
- Add `<meta name="color-scheme" content="light dark">` to the head so the user agent may theme native
  controls for both schemes.
- Do not add a manifest, service worker, PWA, or any JavaScript theme detection; the theme is still
  toggled in component state (`src/App.tsx:946-947`).
- Do not change `src/index.css` color values in this issue.

## Files and areas to touch

- `index.html`
- A new `public/favicon.svg` (or the repository's existing static-asset convention)
- `docs/manual-test-checklist.md` (one checklist line)

## Dependencies

- None. Independent of the theme-preference persistence work in draft "Persist the Theme Choice"; that issue decides whether
  the choice survives reload, this issue only declares the supported schemes.

## Measurable acceptance criteria

- `npm run build` emits the favicon into `dist/` and `dist/index.html` contains the `rel="icon"` link.
- Loading the built site produces no `404` request for `/favicon.ico`.
- The document head contains `<meta name="color-scheme" content="light dark">`.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` pass.

## Expected deliverables

- An SVG favicon, the two head references, and a manual-checklist line stating that the tab icon and
  native control theming render in both themes.

## How to set up and run tests

- `npm ci` then `npm run build`.
- Serve the build (`npm run preview`) and confirm the tab icon appears and the network panel shows no
  `404` for the icon request.
- Run `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`.

## Out of scope

- PWA manifest, offline caching, app icons for mobile home screens, per-route icons, and any change to
  the light/dark palette.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: trivial`.
