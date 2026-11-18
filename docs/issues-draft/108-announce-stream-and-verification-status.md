# Announce Activity Stream and Verification Status Changes

**Complexity:** intermediate

## Context

> **Overlap note:** Sub-task of open issue "Accessibility Pass". Narrowed to live-region announcements for stream and verification status.

The activity panel shows a status region in `src/App.tsx` (the `<div className={`stream-status ${activityStream}`}>` region at lines 1332Ã¢â‚¬â€œ1341) that changes between "Connecting", "Live stream", "Polling fallback", and "Offline" but has no live-region role. `verifyRecord` (function `verifyRecord`, lines 682Ã¢â‚¬â€œ696) flips the record to `pending` while checking and the ledger counts refresh afterwards, both silently. Affected: screen-reader users who cannot tell whether live updates or verification are working. Current behavior: status transitions are not announced. Expected behavior: `role="status"` and `aria-live="polite"` are added to the stream-status region; a visually hidden live region announces verification start and completion.

## Acceptance criteria

- The stream-status element (line 1332) has `role="status"` and `aria-live="polite"`, and its text content changes when `activityStream` transitions `offline Ã¢â€ â€™ live` without user action.
- Starting a verification sets a live region's text to include `Checking`, and completion sets it to the resulting `labelStatus(...)` value.
- Re-rendering the component with an unchanged `activityStream` and verification state leaves every live region's text unchanged (asserted by a test).
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` exit with code 0.

## Files to touch

- `src/App.tsx`
- `src/index.css` (visually hidden helper if one is added)
- `docs/manual-test-checklist.md`

## Test expectations

- Manual: run `npm run dev`, connect a wallet, and with a screen reader observe the status announcements while switching networks or blocking Horizon.
- Run: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`

## Out of scope

Polling/streaming behavior, notification duration, toast announcement, or verification semantics.

## Depends on

None
