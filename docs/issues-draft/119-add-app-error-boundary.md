# Wrap the Application in an Error Boundary With a Recoverable Fallback

**Complexity:** medium

## Context

`src/main.tsx` (lines 6–10) mounts `<App />` inside `StrictMode` with no error boundary. React unmounts the whole tree when a render-phase error escapes, so any thrown error — a `.map` over a malformed API payload, an unexpected `null` in a record, a `new Date(invalid)` path — produces a permanently blank page with no message and no way back except a manual reload. There is no boundary component anywhere (confirmed by searching for `ErrorBoundary`/`componentDidCatch`) and no top-level `window.onerror` handling in `src/`. Affected: any user whose data triggers a render error; they see a white screen and cannot tell whether the app is broken or still loading, which is especially damaging for a transparency tool where the public ledger is the product.

## Acceptance criteria

- Throwing during render (e.g. by temporarily making `App` throw once) shows the fallback instead of a blank page, and the rest of the document (title, styles) remains styled.
- The fallback contains no stack trace or serialized error.
- The reload button reloads the page and, with the temporary throw removed, the app renders normally.
- `npm run typecheck`, `npm run lint`, `npm run build` pass.

## Files to touch

- `src/main.tsx`
- A new boundary component file under `src/`
- `src/index.css` (fallback styles only)
- `docs/manual-test-checklist.md` (one checklist line)

## Test expectations

- Manual: run `npm run dev`, temporarily insert `throw new Error('boom')` in `App`'s render, confirm the fallback renders, then remove it.
- Run: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`

## Out of scope

Error reporting services, retry logic for failed API calls (tracked by "Add a retry action to the ledger load error"), per-section boundaries, or changing the existing inline `error`/`toast` UI.

## Depends on

None
