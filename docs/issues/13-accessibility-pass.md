# Accessibility Pass

**Complexity:** medium

## Context

Core flows should be usable with keyboard navigation and assistive technology. A focused audit can identify issues in dialogs, forms, status updates, and dense tables.

## Acceptance criteria

- Audit login, record creation/editing, verification status, admin roles, and audit views.
- Add semantic labels, focus management, keyboard support, and non-color status cues where missing.
- Fix contrast and reduced-motion issues without changing authorization behavior.
- Document remaining exceptions with rationale.

## Files to touch

- `src/App.tsx`
- `src/fullstack.css`
- `src/index.css`
- `tests/` accessibility-focused coverage

## Test expectations

- Add automated checks for critical views and keyboard flow.
- Manually verify keyboard-only use and a screen reader on supported platforms.
- Run `npm run check`.
