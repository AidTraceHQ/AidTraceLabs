# Deployment

AidTrace has not been deployed or production-qualified. These notes describe the checked-in application and its expected configuration, not a hosted service.

## Hosting options

Run the Express API on a Node.js 20+ host/container/VM connected to PostgreSQL, and serve the Vite build from a static host or the same reverse proxy. Prefer a same-origin HTTPS proxy for `/api`; the session cookie is Secure, HttpOnly, and SameSite=Lax. A cross-site frontend/API deployment may require cookie/CORS design changes and browser verification.

`Dockerfile` builds the API. `docker-compose.yml` describes a local API, Vite web server, and PostgreSQL service. Docker is unavailable in the current environment, so Compose has not been run or verified.

## Environment variables

| Variable                     | Purpose                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                   | Runtime environment. Production requires explicit secrets.                                         |
| `PORT`                       | Express listen port; defaults to `3001`.                                                           |
| `DATABASE_URL`               | PostgreSQL runtime connection. For remote PostgreSQL, include `sslmode=verify-full`.               |
| `TEST_DATABASE_URL`          | Dedicated disposable/test database used by integration tests. Never use production.                |
| `TEST_DATABASE_URL_UNPOOLED` | Direct test endpoint used by the test safety check.                                                |
| `TEST_DATABASE_BRANCH`       | Must be `test` when a test database URL is configured.                                             |
| `PRODUCTION_DATABASE_HOST`   | Production hostname used to reject accidental production test targets.                             |
| `SESSION_SECRET`             | At least 32 random bytes; session/CSRF-related signing key.                                        |
| `PSEUDONYM_SECRET`           | Different key of at least 32 random bytes for beneficiary HMAC pseudonyms. Required in production. |
| `PUBLIC_APP_ORIGIN`          | Exact public frontend origin bound into the wallet challenge.                                      |
| `CORS_ALLOWED_ORIGINS`       | Comma-separated exact allowed origins.                                                             |
| `ADMIN_WALLET`               | Public Stellar address for the one-time admin seed command.                                        |
| `DEFAULT_STELLAR_NETWORK`    | Default network; configured testnet is the development default.                                    |
| `HORIZON_TESTNET_URL`        | Read-only testnet Horizon endpoint.                                                                |
| `HORIZON_MAINNET_URL`        | Read-only mainnet Horizon endpoint.                                                                |
| `VITE_API_BASE_URL`          | Optional frontend API base; leave empty for same-origin `/api`.                                    |

Do not commit `.env` or paste connection strings into logs/issues. `.env.example` contains local placeholders. On Neon, point development to a dev branch and tests to a separate test branch; configure the production-host guard with the production hostname without exposing connection strings.

## Migrations and administrator seed

Run `npm run db:migrate` as a deployment step before starting the API. Migrations should be run by an appropriately restricted deployment identity. Set `ADMIN_WALLET` to a public G-address and run `npm run db:seed-admin` for first-time bootstrap; do not expose this command as a public route.

## Network selection

The UI/API support testnet and mainnet selection. Use testnet for development and tests. Mainnet verification reads public Horizon data, but the application does not send payments. Never describe a matching transaction as proof of identity, consent, intended use, or impact.

## Operations still required

Configure PostgreSQL network restrictions, encrypted backups and tested restore procedures, monitoring, rate limits for public reads, and database readiness checks. `/api/_healthcheck` reports process liveness only. Production hosting, backups, restore, and browser cookie behavior have not been exercised as part of this repository work.
