# Deployment

AidTrace has not been deployed or production-qualified. These notes describe the checked-in application and its expected configuration, not a hosted service.

## Hosting options

Run the Express API on a Node.js 20+ host/container/VM connected to PostgreSQL, and serve the Vite build from a static host or the same reverse proxy. Prefer a same-origin HTTPS proxy for `/api`; the session cookie is Secure, HttpOnly, and SameSite=Lax. A cross-site frontend/API deployment may require cookie/CORS design changes and browser verification.

`Dockerfile` builds the API. `docker-compose.yml` describes a local API, Vite web server, and PostgreSQL service. Docker is unavailable in the current environment, so Compose has not been run or verified.

## Environment variables

| Variable                           | Purpose                                                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                         | Runtime environment. Production requires explicit secrets.                                                |
| `PORT`                             | Express listen port; defaults to `3001`.                                                                  |
| `DATABASE_URL`                     | PostgreSQL runtime connection. For remote PostgreSQL, include `sslmode=verify-full`.                      |
| `DATABASE_URL_UNPOOLED`            | Direct connection used for migrations; authenticate as the separate `aidtrace_migration` owner role.      |
| `TEST_DATABASE_URL`                | Dedicated disposable/test database used by integration tests. Never use production.                       |
| `TEST_DATABASE_URL_UNPOOLED`       | Direct test connection used for migrations and maintenance cleanup; use the test branch's migration role. |
| `TEST_DATABASE_BRANCH`             | Must be `test` when a test database URL is configured.                                                    |
| `PRODUCTION_DATABASE_HOST`         | Production hostname used to reject accidental production test targets.                                    |
| `SESSION_SECRET`                   | At least 32 random bytes; session/CSRF-related signing key.                                               |
| `PSEUDONYM_SECRET`                 | Different key of at least 32 random bytes for beneficiary HMAC pseudonyms. Required in production.        |
| `PUBLIC_APP_ORIGIN`                | Exact public frontend origin bound into the wallet challenge.                                             |
| `CORS_ALLOWED_ORIGINS`             | Comma-separated exact allowed origins.                                                                    |
| `ADMIN_WALLET`                     | Public Stellar address for the one-time admin seed command.                                               |
| `DEFAULT_STELLAR_NETWORK`          | Default network; configured testnet is the development default.                                           |
| `HORIZON_TESTNET_URL`              | Read-only testnet Horizon endpoint.                                                                       |
| `HORIZON_MAINNET_URL`              | Read-only mainnet Horizon endpoint.                                                                       |
| `VITE_API_BASE_URL`                | Optional frontend API base; leave empty for same-origin `/api`.                                           |
| `PUBLIC_READ_RATE_LIMIT_WINDOW_MS` | Public transparency and health-check per-IP window; defaults to `900000` (15 minutes).                    |
| `PUBLIC_READ_RATE_LIMIT_MAX`       | Public transparency and health-check requests per IP per window; defaults to `600`.                       |
| `API_RATE_LIMIT_WINDOW_MS`         | API-wide per-IP rate-limit window; defaults to `900000` (15 minutes).                                     |
| `API_RATE_LIMIT_MAX`               | API-wide requests per IP per window; defaults to `120`.                                                   |
| `AUTH_RATE_LIMIT_WINDOW_MS`        | `/api/auth/*` per-IP rate-limit window; defaults to `900000` (15 minutes).                                |
| `AUTH_RATE_LIMIT_MAX`              | `/api/auth/*` requests per IP per window; defaults to `20`.                                               |
| `TRUST_PROXY_HOPS`                 | Number of trusted reverse-proxy hops; defaults to `0` (trust no forwarded client IP).                     |

Do not commit `.env` or paste connection strings into logs/issues. `.env.example` contains local placeholders. On Neon, point development to a dev branch and tests to a separate test branch; configure the production-host guard with the production hostname without exposing connection strings.

The API limits use express-rate-limit's default in-memory store, which is per process/instance; multiple replicas do not share counters. Use a shared store if limits must apply across replicas. `TRUST_PROXY_HOPS` controls Express proxy trust and therefore which forwarded IP is used by the per-IP limits. Keep it at `0` when the API is directly exposed; behind a reverse proxy, set the exact trusted hop count for the deployment topology. Do not trust arbitrary forwarded headers or set broad proxy trust without a known trusted network path.

## Deployment checklist

- [ ] You must set `TRUST_PROXY_HOPS` when deployed behind a proxy; use the exact number of trusted proxy hops.
- [ ] Confirm public-read, API, and auth per-IP limits match expected traffic and replica topology.

## Migrations and administrator seed

Run `npm run db:migrate` as a deployment step before starting the API. Migrations should be run by an appropriately restricted deployment identity. For first-time bootstrap, set `ADMIN_WALLET` to a public G-address and set both `ADMIN_SEED_TARGET` and `ADMIN_SEED_CONFIRM_TARGET` to the same target label: `dev`, `test`, `demo`, or `production`. For example, production bootstrap requires both values to be `production`; the script exits without connecting to PostgreSQL if the target is missing, unsupported, or not confirmed exactly.

The target label is the operator's confirmation; it is not inferred from or verified against `DATABASE_URL`. Before running, verify the selected database/branch in the secret manager or provider console. The script prints only the target label and wallet suffix, never the connection string or full address. Run `npm run db:seed-admin` as a one-time operator command; do not expose it as a public route or set these confirmation values in the application's runtime environment.

## Scheduled verification refresh

There is no hosted scheduler configured. An operator may run `npm run records:reverify` as a standalone Node.js job after applying database migrations. Schedule it externally only where the operator controls the environment and can monitor its exit status and JSON summary.

Each invocation considers non-voided records with a non-empty transaction hash whose latest verification is at least 24 hours old. It claims at most 50 records in PostgreSQL before calling Horizon, processes the claims sequentially, and stops after two minutes. Claims expire after three minutes if a process exits unexpectedly. Horizon requests retain the verifier's existing ten-second request timeout and operation-page limit; a transient failure is appended as `pending`, not as a final mismatch. Results are appended to `verification_results`; prior history is not edited. A concurrent invocation skips active claims. The summary logs the claimed, processed, pending, skipped, and timed-out counts.

The job refreshes records when explicitly invoked; this repository does not assert that any production scheduler is running.

## Network selection

The UI/API support testnet and mainnet selection. Use testnet for development and tests. Mainnet verification reads public Horizon data, but the application does not send payments. Never describe a matching transaction as proof of identity, consent, intended use, or impact.

## PostgreSQL network restrictions

Network restrictions are **not verified or evidenced for the deployed demo**. The repository documents a Vercel Function connected to a Neon branch, but does not record the Vercel or Neon account plans, Vercel egress configuration, Neon IP Allow settings, or a successful allow/deny test. Check the actual account settings before claiming that database network restrictions are enabled.

The relevant plan requirements are different on each provider:

- Vercel Functions do not have a stable egress IP by default. Vercel Static IPs are available on Pro and Enterprise, require separate project configuration, and route function egress through configured addresses. Secure Compute provides dedicated egress on Enterprise. Do not allowlist an IP observed from an unconfigured function or a developer workstation. See [Vercel Static IPs](https://vercel.com/docs/networking/static-ips) and [Secure Compute](https://vercel.com/docs/networking/secure-compute).
- Neon IP Allow is available on the Scale plan. It restricts PostgreSQL connections only; it is not a network restriction for other Neon services. See [Neon IP Allow](https://neon.com/docs/introduction/ip-allow) and [Neon plans](https://neon.com/docs/introduction/plans).

If either account lacks the required feature, stop: do not claim or try to simulate a network deny check. Upgrade/configure supported plans or host the application where its database egress can be controlled. Vercel Static IPs are an optional configured feature, not an assumed property of every Vercel plan. If using Static IPs, account for the configured function region and whether build traffic is also routed through them. Keep database credentials and TLS verification enabled regardless of network rules.

### Operator allow/deny check

Run this before claiming the restriction is verified, and repeat after changing plans, regions, or networking configuration. The check exercises only a dedicated Neon test project/branch with synthetic or empty data. **Never point either check at production or a branch copied from production.** It does not read or change production data.

1. In Vercel and Neon, record the active plans and verify that the Vercel project has Static IPs or Secure Compute enabled for the function environment being tested, and Neon Scale has IP Allow enabled with the intended branch scope. Confirm that the Vercel egress addresses shown by that project's networking settings—not an IP guessed from a request—are on the Neon allowlist. If the deployment uses another host, verify its documented static egress instead.
2. Create or select a dedicated Neon test project on Scale, with an isolated branch containing no production data. Configure its IP Allow rules to match the intended policy. Configure a Vercel Preview deployment to use that branch's pooled connection string as `DATABASE_URL`; do not change the Production environment variable or the production project's Neon settings. Ensure the test source used for the negative check is not on the allowlist.
3. In the Preview deployment only, use a temporary, operator-only diagnostic that runs exactly `SELECT 1` through the application's configured PostgreSQL pool and returns only the scalar result. Do not accept SQL input, return connection details, or log the connection string or raw connection errors. Invoke it from the Preview deployment so the permitted check uses the application's Vercel egress. Expected result: `1`. Remove the diagnostic and its temporary access control after the check.
4. From a separate authorized test machine or runner whose public egress is not allowlisted, use the same test branch credentials to attempt a PostgreSQL connection and `SELECT 1`. Keep the connection string in a protected local service/secret configuration, not in command history or output. A nonzero client exit alone is insufficient: verify that the rejection is specifically due to the Neon IP Allow rule, not bad credentials, DNS, TLS, or a timeout. Do not retry with production credentials or alter the allowlist to admit this test source.
5. Capture only redacted evidence in the deployment record. Do not include URLs, connection strings, hostnames, usernames, IP addresses, tokens, or raw client output. Example format (replace the status with the actual observed result; this is a template, not evidence):

   ```text
   Check: PostgreSQL network allow/deny
   Environment: isolated test branch; synthetic/empty data
   Allowed source: Vercel Preview Function; SELECT 1 -> 1
   Disallowed source: separate unlisted test runner; rejected by Neon IP Allow
   Output: connection details redacted; no URLs or credentials recorded
   Result: PASS only when both outcomes above were observed
   ```

6. Remove any temporary diagnostic and credentials; confirm the Production `DATABASE_URL` and production project's Neon settings were not changed during the test. Record the date, plan/features, branch scope, and operator alongside the redacted outcomes. If the application cannot execute the permitted check through its actual hosting egress, the check is incomplete.

## Operations still required

Complete and evidence PostgreSQL network restrictions using the procedure above, plus encrypted backups and tested restore procedures, monitoring, rate limits for public reads, and database readiness checks. `/api/_healthcheck` reports process liveness only. The network check above has not been run as part of this repository work; production hosting, backups, restore, and browser cookie behavior have not been exercised as part of this repository work.
