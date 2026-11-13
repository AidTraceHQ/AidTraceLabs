# Wrap the Application in an Error Boundary With a Recoverable Fallback

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 2

## Problem statement

`src/main.tsx:6-10` mounts `<App />` inside `StrictMode` with no error boundary. React unmounts the
whole tree when a render-phase error escapes, so any thrown error — a `.map` over a malformed API
payload, an unexpected `null` in a record, a `new Date(invalid)` path — produces a permanently blank
page with no message and no way back except a manual reload.

There is no boundary component anywhere (`grep` for `ErrorBoundary`/`componentDidCatch` finds nothing)
and no top-level `window.onerror` handling in `src/`.

Affected: any user whose data triggers a render error; they see a white screen and cannot tell whether
the app is broken or still loading, which is especially damaging for a transparency tool where the
public ledger is the product.

## Technical implementation requirements

- Add a small error-boundary component that catches render errors and renders a fallback inside the
  existing page shell, reusing the current typography and button styles (`src/index.css`).
- The fallback must state that something went wrong, show no stack trace or raw error object to the
  user, and offer a "Reload" action that calls `window.location.reload()`.
- Wrap `<App />` with the boundary in `src/main.tsx` so the fallback also covers errors thrown while
  rendering the top bar and tab bar.
- Keep React StrictMode (`src/main.tsx:7`) and do not add a state-management or error-reporting
  dependency.
- Do not catch errors in event handlers or async callbacks by wrapping them in the boundary; those are
  already handled by the existing `error` state and toast paths (`src/App.tsx:1027-1038`). The boundary
  is for render-phase failures only.
- Do not log the raw error to a third party; a `console.error` in `componentDidCatch` is acceptable.

## Files and areas to touch

- `src/main.tsx`
- A new boundary component file under `src/`
- `src/index.css` (fallback styles only)
- `docs/manual-test-checklist.md` (one checklist line)

## Dependencies

- None. Independent of the accessibility drafts (the accessibility drafts ("Trap and Restore Focus in the Record and Disbursement Dialogs" through "Add a Skip-to-Content Link for Keyboard Users")) and the API error contract work.

## Measurable acceptance criteria

- Throwing during render (for example by temporarily making `App` throw once) shows the fallback
  instead of a blank page, and the rest of the document (title, styles) remains styled.
- The fallback contains no stack trace or serialized error.
- The reload button reloads the page and, with the temporary throw removed, the app renders normally.
- `npm run typecheck`, `npm run lint`, `npm run build` pass.

## Expected deliverables

- The boundary component, its integration in `src/main.tsx`, fallback styles, and a manual-test line
  describing how to verify it.

## How to set up and run tests

- `npm run dev`; temporarily insert a `throw new Error('boom')` in `App`'s render, confirm the fallback
  renders, then remove it.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`.

## Out of scope

- Error reporting services, retry logic for failed API calls (draft "Add a retry action to the ledger load error"), per-section boundaries, or
  changing the existing inline `error`/`toast` UI.

## Suggested labels

- `area: frontend`, `type: enhancement`, `difficulty: medium`.
