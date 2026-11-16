# Respect prefers-reduced-motion for the Skeleton Shimmer and Smooth Scroll

**Complexity:** trivial

## Context

Partly a sub-task of open issue "Accessibility Pass". This draft is narrowed to `prefers-reduced-motion` only.

The loading skeleton runs an infinite shimmer animation in `src/index.css` (the `.skeleton` rule at lines 620–629; `@keyframes shimmer` at lines 977–981) and the "Explore public records" button always scrolls smoothly in `src/App.tsx` (line 1000, calling `scrollIntoView({ behavior: 'smooth' })`). Neither consults `prefers-reduced-motion`. There is no `prefers-reduced-motion` rule anywhere in the stylesheet (confirmed by reading `src/index.css`). Affected: users who have requested reduced motion and may experience vestibular discomfort from continuous animation.

## Acceptance criteria

- With `window.matchMedia('(prefers-reduced-motion: reduce)').matches === true`, `getComputedStyle(document.querySelector('.skeleton')).animationName` is `none`, and clicking "Explore public records" invokes `scrollIntoView` with `{ behavior: 'auto' }`.
- With `matchMedia('(prefers-reduced-motion: reduce)').matches === false`, `.skeleton` still computes `animationName: shimmer` and the button invokes `scrollIntoView` with `{ behavior: 'smooth' }`.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` exit with code 0.

## Files to touch

- `src/index.css`
- `src/App.tsx`
- `docs/manual-test-checklist.md`

## Test expectations

- Manual: run `npm run dev`, enable "reduce motion" at the OS level (or emulate in DevTools rendering settings), reload, and confirm the skeleton is static and the ledger jump is instant.
- Run: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`

## Out of scope

Reduced-motion handling for animations added later, parallax effects, or third-party widgets.

## Depends on

None
