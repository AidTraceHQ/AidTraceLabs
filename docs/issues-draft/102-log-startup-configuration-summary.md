# Log a startup configuration summary without secrets

**Complexity:** Beginner (Trivial, 100 pts)

**Estimated effort:** 3 hours

**Release day:** Day 5

## Problem statement

Startup validates the environment but reports nothing about what it found. `validateEnvironment`
(`server/environment.ts:30-96`) checks secret length, placeholder prefixes, and CORS entries, then
returns; `server/index.ts:11` (the `app.listen` callback's
`console.log('AidTrace API listening on port ' + port + '.')`) logs only the listening port. When a deployment is misconfigured — a
missing `PUBLIC_APP_ORIGIN`, an empty CORS allow-list, or the fallback Horizon URL — there is no
startup line to inspect. Affected: operators and reviewers deploying the API.

## Technical implementation requirements

- After validation succeeds, log a summary of configuration **presence and shape only**: whether
  `DATABASE_URL` is set, whether each secret is present and its length category (never the value),
  `PUBLIC_APP_ORIGIN`, the number of configured CORS origins, the resolved Horizon hosts, the default
  network, and the resolved `TRUST_PROXY_HOPS`.
- Never print secret values, the connection string, its host, or its user.
- Log once, at startup, at a stable, greppable prefix.
- Do not change validation rules or defaults.

## Files and areas to touch

- `server/environment.ts` (or a small helper it calls)
- `server/index.ts`

## Dependencies

- None. Do not print values that the "reject reused runtime secrets" draft ("Reject Reuse of Session and Pseudonym Secrets") rejects; they are
  different concerns.

## Measurable acceptance criteria

- Running `npm run dev:server` prints exactly one line prefixed with a stable marker (e.g.
  `AidTrace config:`) that lists each required variable by name, its presence, and `corsOrigins=<n>`,
  where `<n>` equals the number of comma-separated entries in `CORS_ALLOWED_ORIGINS`.
- The captured line contains the literal names `SESSION_SECRET`, `PSEUDONYM_SECRET`, and
  `DATABASE_URL`, but the values of `SESSION_SECRET`, `PSEUDONYM_SECRET`, and the `DATABASE_URL`
  connection string never appear in the output.
- `npm run typecheck` and `npm test` exit with code 0.

## Expected deliverables

- A startup configuration summary and a test asserting secrets are not printed.

## How to set up and run tests

- Run `npm run dev` and inspect the startup output; grep that no secret value appears.
- Run `npm run typecheck` and `npm test`.

## Out of scope

- Logging levels/transports, request logging, and any change to environment validation.

## Suggested labels

- `area: infrastructure`, `area: backend`, `type: enhancement`, `difficulty: trivial`
