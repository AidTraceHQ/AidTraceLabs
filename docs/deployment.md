# Deployment

AidTrace has not been deployed or production-qualified. These notes describe the checked-in application and its expected configuration, not a hosted service.

## Hosting options

Run the Express API on a Node.js 20+ host/container/VM connected to PostgreSQL, and serve the Vite build from a static host or the same reverse proxy. Prefer a same-origin HTTPS proxy for `/api`; the session cookie is Secure, HttpOnly, and SameSite=Lax. A cross-site frontend/API deployment may require cookie/CORS design changes and browser verification.

`Dockerfile` builds the API. `docker-compose.yml` describes a local API, Vite web server, and PostgreSQL service. Docker is unavailable in the current environment, so Compose has not been run or verified.

## Environment variables

| Variable                           | Purpose                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                         | Runtime environment. Production requires explicit secrets.                                         |
| `PORT`                             | Express listen port; defaults to `3001`.                                                           |
| `DATABASE_URL`                     | PostgreSQL runtime connection. For remote PostgreSQL, include `sslmode=verify-full`.               |
| `TEST_DATABASE_URL`                | Dedicated disposable/test database used by integration tests. Never use production.                |
| `TEST_DATABASE_URL_UNPOOLED`       | Direct test endpoint used by the test safety check.                                                |
| `TEST_DATABASE_BRANCH`             | Must be `test` when a test database URL is configured.                                             |
| `PRODUCTION_DATABASE_HOST`         | Production hostname used to reject accidental production test targets.                             |
| `SESSION_SECRET`                   | At least 32 random bytes; session/CSRF-related signing key.                                        |
| `PSEUDONYM_SECRET`                 | Different key of at least 32 random bytes for beneficiary HMAC pseudonyms. Required in production. |
| `PUBLIC_APP_ORIGIN`                | Exact public frontend origin bound into the wallet challenge.                                      |
| `CORS_ALLOWED_ORIGINS`             | Comma-separated exact allowed origins.                                                             |
| `ADMIN_WALLET`                     | Public Stellar address for the one-time admin seed command.                                        |
| `DEFAULT_STELLAR_NETWORK`          | Default network; configured testnet is the development default.                                    |
| `HORIZON_TESTNET_URL`              | Read-only testnet Horizon endpoint.                                                                |
| `HORIZON_MAINNET_URL`              | Read-only mainnet Horizon endpoint.                                                                |
| `VITE_API_BASE_URL`                | Optional frontend API base; leave empty for same-origin `/api`.                                    |
| `PUBLIC_READ_RATE_LIMIT_WINDOW_MS` | Public transparency and health-check per-IP window; defaults to `900000` (15 minutes).             |
| `PUBLIC_READ_RATE_LIMIT_MAX`       | Public transparency and health-check requests per IP per window; defaults to `600`.                |
| `API_RATE_LIMIT_WINDOW_MS`         | API-wide per-IP rate-limit window; defaults to `900000` (15 minutes).                              |
| `API_RATE_LIMIT_MAX`               | API-wide requests per IP per window; defaults to `120`.                                            |
| `AUTH_RATE_LIMIT_WINDOW_MS`        | `/api/auth/*` per-IP rate-limit window; defaults to `900000` (15 minutes).                         |
| `AUTH_RATE_LIMIT_MAX`              | `/api/auth/*` requests per IP per window; defaults to `20`.                                        |
| `TRUST_PROXY_HOPS`                 | Number of trusted reverse-proxy hops; defaults to `0` (trust no forwarded client IP).              |

Do not commit `.env` or paste connection strings into logs/issues. `.env.example` contains local placeholders. On Neon, point development to a dev branch and tests to a separate test branch; configure the production-host guard with the production hostname without exposing connection strings.

The API limits use express-rate-limit's default in-memory store, which is per process/instance; multiple replicas do not share counters. Use a shared store if limits must apply across replicas. `TRUST_PROXY_HOPS` controls Express proxy trust and therefore which forwarded IP is used by the per-IP limits. Keep it at `0` when the API is directly exposed; behind a reverse proxy, set the exact trusted hop count for the deployment topology. Do not trust arbitrary forwarded headers or set broad proxy trust without a known trusted network path.

## Deployment checklist

- [ ] You must set `TRUST_PROXY_HOPS` when deployed behind a proxy; use the exact number of trusted proxy hops.
- [ ] Confirm public-read, API, and auth per-IP limits match expected traffic and replica topology.

## Migrations and administrator seed

Run `npm run db:migrate` as a deployment step before starting the API. Migrations should be run by an appropriately restricted deployment identity. Set `ADMIN_WALLET` to a public G-address and run `npm run db:seed-admin` for first-time bootstrap; do not expose this command as a public route.

## Network selection

The UI/API support testnet and mainnet selection. Use testnet for development and tests. Mainnet verification reads public Horizon data, but the application does not send payments. Never describe a matching transaction as proof of identity, consent, intended use, or impact.

## Operations still required

Configure PostgreSQL network restrictions, encrypted backups and tested restore procedures, monitoring, rate limits for public reads, and database readiness checks. `/api/_healthcheck` reports process liveness only. Production hosting, backups, restore, and browser cookie behavior have not been exercised as part of this repository work.
