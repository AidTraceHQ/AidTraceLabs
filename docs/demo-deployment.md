# Demo deployment on Vercel

This document describes a public demo of AidTrace where the Vite frontend and the Express API are
served from the **same Vercel origin**. It has **not** been deployed, and none of the steps below
have been executed against a real Vercel project — everything here is the intended configuration,
verified only against the code in this repository.

Nothing in this file contains a secret or a connection string. Set real values only in the Vercel
dashboard (and never commit them).

## What is deployed

| Piece             | Source                                        | Served as                                    |
| ----------------- | --------------------------------------------- | -------------------------------------------- |
| Frontend (static) | Vite build output                             | Static files on Vercel's CDN (`dist/`)       |
| API               | The Express app exported from `server/app.ts` | A single Vercel Function, entered via `api/` |

- `api/index.ts` default-exports the Express app. Vercel only auto-detects an Express app at the
  repository root, so the explicit `api/` entry is required — `server/app.ts` is not a root entry.
- `vercel.json` rewrites `/api/*` to that function (the original request path is preserved, so the
  existing `/api/...` routes keep working) and falls back to `/index.html` for everything else.
- Because both parts share one origin, `VITE_API_BASE_URL` stays empty, the session cookie stays
  first-party, and the `Origin`/CSRF checks compare against the deployment's own origin.
- Local development is unchanged: `npm run dev` still starts `server/index.ts` (port 3001) plus the
  Vite dev server, and `server/index.ts` is **not** used by the Vercel Function.

Verified locally (not on Vercel): `npm run check`, `npm run smoke`, and a unit test asserting that
`api/index.ts` exports a callable handler and that the connection pool switches to its small
serverless settings when `VERCEL` is set.

## Vercel project settings

| Setting          | Value                                        |
| ---------------- | -------------------------------------------- |
| Framework preset | Vite                                         |
| Build command    | `npm run build`                              |
| Output directory | `dist`                                       |
| Install command  | default (`npm install`)                      |
| Root directory   | repository root                              |
| Node.js version  | 20.x or 22.x (whatever the dashboard offers) |

These values are also pinned in `vercel.json`, so a Git-connected import of this repository should
match them automatically. If the dashboard shows something different, set it to the table above.

## Environment variables

Set these under **Vercel → Project → Settings → Environment Variables** (Production, and Preview if
you want preview URLs to work). Names only — generate or copy the values yourself.

| Variable                           | Where to get it / how to generate it                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                         | Set to `production`.                                                                                                                                       |
| `DATABASE_URL`                     | Pooled connection string of the **`demo`** Neon branch (Neon Console → Connection details, "Pooled connection"). Keep `sslmode=verify-full` in the string. |
| `DATABASE_URL_UNPOOLED`            | Direct (non-pooled) connection string of the same `demo` branch. Used only by `npm run db:migrate`; not needed at request time but harmless to set.        |
| `SESSION_SECRET`                   | Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` — must be at least 32 bytes.                                    |
| `PSEUDONYM_SECRET`                 | Generate the same way, with a **different** value. Required because `NODE_ENV` is not `development`.                                                       |
| `PUBLIC_APP_ORIGIN`                | The demo origin, e.g. `https://<project>.vercel.app` (your real deployment URL, no trailing slash). Bound into the wallet login challenge message.         |
| `CORS_ALLOWED_ORIGINS`             | Same value as `PUBLIC_APP_ORIGIN`. Add comma-separated preview origins only if you need them.                                                              |
| `DEFAULT_STELLAR_NETWORK`          | `testnet` for a demo.                                                                                                                                      |
| `HORIZON_TESTNET_URL`              | `https://horizon-testnet.stellar.org`.                                                                                                                     |
| `HORIZON_MAINNET_URL`              | `https://horizon.stellar.org`.                                                                                                                             |
| `TRUST_PROXY_HOPS`                 | `1` — Vercel terminates TLS at one proxy hop, so the API must trust exactly one forwarded hop for `req.ip`, the per-IP rate limits, and secure cookies.    |
| `PUBLIC_READ_RATE_LIMIT_WINDOW_MS` | Optional; defaults to `900000`.                                                                                                                            |
| `PUBLIC_READ_RATE_LIMIT_MAX`       | Optional; defaults to `600`.                                                                                                                               |
| `API_RATE_LIMIT_WINDOW_MS`         | Optional; defaults to `900000`.                                                                                                                            |
| `API_RATE_LIMIT_MAX`               | Optional; defaults to `120`.                                                                                                                               |
| `AUTH_RATE_LIMIT_WINDOW_MS`        | Optional; defaults to `900000`.                                                                                                                            |
| `AUTH_RATE_LIMIT_MAX`              | Optional; defaults to `20`.                                                                                                                                |
| `VITE_API_BASE_URL`                | Leave unset or empty — the frontend uses same-origin `/api`.                                                                                               |

Not needed on Vercel:

- `PORT` — Vercel assigns the port; only `server/index.ts` (local/long-running) reads it.
- `TEST_DATABASE_URL`, `TEST_DATABASE_URL_UNPOOLED`, `TEST_DATABASE_BRANCH`,
  `PRODUCTION_DATABASE_HOST` — test-only.
- `ADMIN_WALLET` — only read by the one-time `npm run db:seed-admin` command, not at runtime.
- `VERCEL` — Vercel sets this automatically. It is what switches the PostgreSQL pool to its small
  serverless size (`max: 3`, 5 s idle timeout, exit when idle). Do not set it yourself.

Note on rate limits: `express-rate-limit` uses its default in-memory store, which is per instance.
On serverless, instances do not share counters, so the effective limit is looser than the configured
value. This is acceptable for a demo and is already documented in `docs/deployment.md`.

## Dedicated Neon branch for the demo

Do not point the demo at the existing `dev`, `test`, or `production` branches. Create a dedicated
branch instead:

1. Create the branch. In the Neon Console open the project → **Branches** → **Create branch**, name
   it `demo`, and choose the parent/point in time you want. Or with the CLI:

   ```bash
   neon branches create --name demo --parent production
   ```

   (Older installs may expose the same command as `neonctl`.)

2. Apply migrations to it, from this repository, with `DATABASE_URL_UNPOOLED` (or `DATABASE_URL`)
   pointed at the `demo` branch for this one command:

   ```bash
   npm run db:migrate
   ```

   Migrations are idempotent — they record applied versions in `schema_migrations`.

3. Copy the `demo` branch's pooled and direct connection strings into the Vercel environment
   variables `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Never paste them into the repository.

4. Optional: seed an administrator with `ADMIN_WALLET` set for that single command
   (`npm run db:seed-admin`). Leave `ADMIN_WALLET` out of the Vercel runtime variables.

If the `demo` branch is created from `production`, it starts as a copy of that data. Create it from a
clean parent (or delete the copied rows) if the demo must not expose existing records.

## Deploying

1. Import the repository into Vercel (or link it with the CLI) and confirm the project settings
   above.
2. Set the environment variables from the table above.
3. Deploy. `npm run build` produces `dist/`, and Vercel builds `api/index.ts` as a Function.
4. Check `https://<project>.vercel.app/api/_healthcheck` returns `{"ok":true,...}` and that the
   frontend loads from the same origin.

## What is not verified

- No Vercel project exists for this repository yet, so nothing in this document has run on Vercel.
- The rewrite behaviour, the Function build of `api/index.ts`, `TRUST_PROXY_HOPS=1`, secure-cookie
  behaviour over Vercel's TLS, and the Origin/CSRF checks against the real deployment URL can only
  be confirmed after the first deploy.
- Local commands that need a database (`npm run smoke`, `npm test`, `npm run db:migrate`) were run
  against the local test/dev configuration only, never against the Neon `demo` branch, which does
  not exist yet.
