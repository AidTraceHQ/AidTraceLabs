<!-- OVERLAP: Sub-task of open issue #23 "Accessibility Pass". Narrowed to prefers-reduced-motion only. -->

# Respect prefers-reduced-motion for the Skeleton Shimmer and Smooth Scroll

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 3 hours

**Release day:** Day 2

## Problem statement

The loading skeleton runs an infinite shimmer animation (`src/index.css:620-629`, the `.skeleton`
rule, whose keyframes are at `src/index.css:977-981`, the `@keyframes shimmer` block) and the
`Explore public records` button always scrolls smoothly (`src/App.tsx:1000`, the button's `onClick`
calling `scrollIntoView({ behavior: 'smooth' })`). Neither consults `prefers-reduced-motion`, so users who
request reduced motion still get continuous animation, which can trigger vestibular discomfort. There
is no `prefers-reduced-motion` rule anywhere in the stylesheet (confirmed by reading `src/index.css`).

## Technical implementation requirements

- Add a `@media (prefers-reduced-motion: reduce)` block that stops or substantially reduces the
  `.skeleton` shimmer (for example a static background instead of an infinite animation).
- Make the `Explore public records` scroll use `behavior: 'auto'` when
  `matchMedia('(prefers-reduced-motion: reduce)').matches` is true, keeping `'smooth'` otherwise.
- Keep the skeleton's visual footprint and layout unchanged when motion is reduced.
- Do not remove the animation for users who have not requested reduced motion.

## Files and areas to touch

- `src/index.css`
- `src/App.tsx`
- `docs/manual-test-checklist.md`

## Dependencies

- None.

## Measurable acceptance criteria

- With `window.matchMedia('(prefers-reduced-motion: reduce)').matches === true`,
  `getComputedStyle(document.querySelector('.skeleton')).animationName` is `none`, and clicking
  `Explore public records` invokes `scrollIntoView` with `{ behavior: 'auto' }`.
- With `matchMedia('(prefers-reduced-motion: reduce)').matches === false`, `.skeleton` still computes
  `animationName: shimmer` and the button invokes `scrollIntoView` with `{ behavior: 'smooth' }`.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` exit with code 0.

## Expected deliverables

- Reduced-motion CSS and a condition around the smooth scroll, plus a checklist note.

## How to set up and run tests

- Run `npm run dev`, enable "reduce motion" at the OS level (or emulate it in DevTools rendering
  settings), reload, and confirm the skeleton is static and the ledger jump is instant.
- Run `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`.

## Out of scope

- Reduced-motion handling for animations added later, parallax effects, or third-party widgets.

## Suggested labels

- `area: accessibility`, `type: enhancement`, `difficulty: trivial`.
