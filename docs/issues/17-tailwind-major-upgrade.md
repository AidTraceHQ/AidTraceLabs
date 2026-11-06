# Deferred: Tailwind CSS 4 major upgrade

**Complexity:** high

## Context

Dependabot opened PR #6 to bump `tailwindcss` from `3.4.19` to `4.3.3` (semver-major). It was closed and deferred because CI fails at build time. Dependabot now ignores semver-major updates for `tailwindcss`, so this upgrade has to be done by hand as a planned change.

CI failure (run `41802901894`, step `npm run build`):

```
[vite:css] [postcss] It looks like you're trying to use 'tailwindcss' directly as a PostCSS plugin.
The PostCSS plugin has moved to a separate package, so to continue using Tailwind CSS with PostCSS
you'll need to install '@tailwindcss/postcss' and update your PostCSS configuration.
```

Tailwind 4 moves the PostCSS plugin into `@tailwindcss/postcss` and changes how configuration and theme tokens are declared, so the upgrade touches `postcss.config.js`, `tailwind.config.js`, and the global stylesheet together.

## Acceptance criteria

- Install `@tailwindcss/postcss` and update `postcss.config.js` to use it instead of `tailwindcss` directly.
- Migrate `tailwind.config.js` (theme, content globs, plugins such as `@tailwindcss/typography` if present) to the Tailwind 4 configuration model, or the documented compatibility path.
- Update the `@tailwind base/components/utilities` directives in `src/index.css` to the Tailwind 4 import form, and confirm custom CSS still applies.
- Keep the UI visually unchanged: no layout or spacing regressions in the record popup, tabs, or ledger.

## Files to touch

- `package.json`
- `package-lock.json`
- `postcss.config.js`
- `tailwind.config.js`
- `src/index.css`

## Test expectations

- Run `npm run check` and confirm the full pipeline, including `npm run build`, is green.
- Build the app and visually check the affected screens (record popup, ledger, tabs) for spacing and layout regressions.
- Confirm `npm ci` succeeds from a clean install with the committed lockfile.
