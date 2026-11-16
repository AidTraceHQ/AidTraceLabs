# Log a Startup Configuration Summary Without Secrets

**Complexity:** trivial

## Context

Startup validates the environment but reports nothing about what it found. `validateEnvironment` in `server/environment.ts` (function `validateEnvironment`, lines 30–96) checks secret length, placeholder prefixes, and CORS entries, then returns. `server/index.ts` (line 11, the `app.listen` callback) logs only the listening port. When a deployment is misconfigured — a missing `PUBLIC_APP_ORIGIN`, an empty CORS allow-list, or the fallback Horizon URL — there is no startup line to inspect. Affected: operators and reviewers deploying the API. Current behavior: only the port is logged at startup. Expected behavior: one log line summarizes configuration presence and shape (never secret values), greppable at a stable prefix.

## Acceptance criteria

- Running `npm run dev:server` prints exactly one line prefixed with a stable marker (e.g. `AidTrace config:`) that lists each required variable by name, its presence, and `corsOrigins=<n>`, where `<n>` equals the number of comma-separated entries in `CORS_ALLOWED_ORIGINS`.
- The captured line contains the literal names `SESSION_SECRET`, `PSEUDONYM_SECRET`, and `DATABASE_URL`, but the values of those variables and the `DATABASE_URL` connection string never appear in the output.
- `npm run typecheck` and `npm test` exit with code 0.

## Files to touch

- `server/environment.ts` (or a small helper it calls)
- `server/index.ts`

## Test expectations

- Run: `npm run dev` and inspect the startup output.
- Run: `npm run typecheck`
- Run: `npm test`

## Out of scope

Logging levels/transports, request logging, and any change to environment validation.

## Depends on

None
