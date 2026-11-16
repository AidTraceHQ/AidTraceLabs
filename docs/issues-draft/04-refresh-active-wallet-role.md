# Reconcile the Active Wallet Role

**Complexity:** medium

## Context

The client restores its role from stored session state at startup, while the API resolves role assignments dynamically from the database. If another admin changes a wallet's role, the open UI shows controls for the previous role until the user manually reloads. Affected users: any wallet holder whose role changes while they have an active session. Current behavior: the role in client state is set once at startup and not refreshed. Expected behavior: the client reconciles the current role from `/api/me` at a bounded lifecycle event (e.g. tab focus) and after receiving `401`/`403` from a protected route. The server remains the authority; client state is display only. Evidence: `src/App.tsx` (role state restoration) and `src/api.ts` (session fetch).

## Acceptance criteria

- A test that changes the role returned by `/api/me` mock and fires the refresh trigger (e.g. tab `focus` event) asserts the UI reflects the new role without a full page reload.
- A test asserts that a `401` or `403` from a protected route causes the privileged control to be not rendered, even when client state still reports the previous role.
- A test fires the refresh trigger N times within a short window and asserts the number of `/api/me` calls stays within a fixed small bound (no unbounded polling loop).

## Files to touch

- `src/App.tsx`
- `src/api.ts`
- `tests/api.test.ts` (or a focused session-state test file)

## Test expectations

- Run: `npx vitest run tests/api.test.ts`
- Run: `npm run typecheck`
- No database setup required for mocked tests.

## Out of scope

Changing wallet login, signatures, sessions, role policy, or administrator assignment rules.

## Depends on

None
