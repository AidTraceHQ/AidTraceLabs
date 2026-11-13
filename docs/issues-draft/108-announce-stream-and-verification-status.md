<!-- OVERLAP: Sub-task of open issue #23 "Accessibility Pass". Narrowed to live-region announcements for stream and verification status. -->

# Announce Activity Stream and Verification Status Changes

**Complexity:** Intermediate (Medium, 150 pts)

**Estimated effort:** 6 hours

**Release day:** Day 3

## Problem statement

The activity panel shows a status that changes between "Connecting", "Live stream", "Polling
fallback", and "Offline" as the Horizon EventSource opens, errors, or falls back
(`src/App.tsx:1332-1341`, the `<div className={`stream-status ${activityStream}`}>` region), but the
region has no live-region role, so a screen-reader user is never
told when the stream connects or drops. Likewise, `verifyRecord` flips the record to `pending`
("Checking…", the `pending` entry of `labelStatus()` at `src/App.tsx:124`) while checking
(`src/App.tsx:682-696`, the `verifyRecord()` function) and the ledger counts refresh
afterwards, both silently. Users of assistive technology cannot tell whether live updates or
verification are working.

## Technical implementation requirements

- Give the stream-status region `role="status"` and `aria-live="polite"` so status transitions are
  announced, keeping the existing text and dot styling.
- Announce verification start and completion politely (for example a visually hidden live region
  reporting the resulting status) without re-reading the whole table.
- Keep the announcements concise to avoid verbose repeated reads.
- Do not change the stream/polling logic, the notification timer, or the verification API.

## Files and areas to touch

- `src/App.tsx`
- `src/index.css` (visually hidden helper if one is added)
- `docs/manual-test-checklist.md`

## Dependencies

- None. This does not change the toast timer covered by `03-fix-toast-timer-race`.

## Measurable acceptance criteria

- The stream-status element (`src/App.tsx:1332`) has `role="status"` and `aria-live="polite"`, and its
  text content changes when `activityStream` transitions `offline → live` without user action.
- Starting a verification sets a live region's text to include `Checking`, and completion sets it to
  the resulting `labelStatus(...)` value.
- Re-rendering the component with an unchanged `activityStream` and verification state leaves every
  live region's text unchanged (asserted by a test).
- `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build` exit with code 0.

## Expected deliverables

- Live-region markup for the stream and verification status plus checklist steps.

## How to set up and run tests

- Run `npm run dev`, connect a wallet, and with a screen reader observe the status announcements while
  switching networks or blocking Horizon.
- Run `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`.

## Out of scope

- Polling/streaming behaviour, notification duration, toast announcement, or verification semantics.

## Suggested labels

- `area: accessibility`, `type: enhancement`, `difficulty: medium`.
