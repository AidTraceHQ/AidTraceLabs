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

Provision distinct PostgreSQL login roles before the first migration: `aidtrace_migration` owns migrated objects and has the privileges required to apply schema changes; `aidtrace_runtime` is the application's non-owner, non-superuser login. Configure `DATABASE_URL` with the runtime login and `DATABASE_URL_UNPOOLED` with the migration login. The runtime role must not own `audit_events`, inherit migration-owner privileges, or receive `UPDATE`/`DELETE` through another role. The same separation applies to `TEST_DATABASE_URL` (runtime) and `TEST_DATABASE_URL_UNPOOLED` (migration) on the dedicated test branch.

Run `npm run db:migrate` as a deployment step before starting the API, using only the isolated development/test branch during development. Migration `005_audit_events_append_only` transfers `audit_events` ownership to the migration identity, removes public/runtime privileges, and grants the runtime role only `SELECT` and `INSERT`. For emergency audit maintenance, use the controlled `aidtrace_migration` owner credential through an approved operator session; never grant that credential to the application. This owner-level path can change or remove audit rows and does not protect against a database superuser. Set `ADMIN_WALLET` to a public G-address and run `npm run db:seed-admin` for first-time bootstrap; do not expose this command as a public route.

### Migration file checksums

Each applied migration is recorded in `schema_migrations` with a SHA-256 checksum of its SQL file. Every run recomputes the checksums and fails before applying anything if a released file changed. Do not edit an applied migration; add a new forward-only migration instead. The failure message names the affected version and checksums only; it never prints file contents or connection credentials.

Databases migrated before checksums existed have `NULL` checksums. Review every recorded file against the deployed schema, then record the reviewed baselines once:

```bash
npm run db:migrate -- --baseline-checksums
```

The baseline command writes checksums only for `NULL` rows. Later runs fail closed on any change to a checksummed file.

## Scheduled verification refresh

There is no hosted scheduler configured. An operator may run `npm run records:reverify` as a standalone Node.js job after applying database migrations. Schedule it externally only where the operator controls the environment and can monitor its exit status and JSON summary.

Each invocation considers non-voided records with a non-empty transaction hash whose latest verification is at least 24 hours old. It claims at most 50 records in PostgreSQL before calling Horizon, processes the claims sequentially, and stops after two minutes. Claims expire after three minutes if a process exits unexpectedly. Horizon requests retain the verifier's existing ten-second request timeout and operation-page limit; a transient failure is appended as `pending`, not as a final mismatch. Results are appended to `verification_results`; prior history is not edited. A concurrent invocation skips active claims. The summary logs the claimed, processed, pending, skipped, and timed-out counts.

The job refreshes records when explicitly invoked; this repository does not assert that any production scheduler is running.

## Backups and restore

No hosted backup provider is configured in this repository. The operator who deploys AidTrace owns the backup configuration, credentials, retention, and restore evidence. Select one provider and record it in the deployment notes:

- Neon: use the project's point-in-time restore or a dedicated restore branch. Never point a restore at the production branch.
- Self-hosted PostgreSQL: take an encrypted logical backup with `pg_dump --format=custom` to access-controlled, off-host storage that supports versioning or object lock.

### Ownership and access

- Backup jobs run under an operator-owned credential, never the `aidtrace_runtime` application credential.
- Encryption keys are stored separately from backups in an approved secret manager.
- Only named operators can read backups or restore targets. Application runtime credentials are never used for restores.
- Backups contain beneficiary-related rows. Do not download dumps to personal machines, paste dumps into tickets, or print row contents.

### Targets

| Objective | Target   | Notes                                                                                   |
| --------- | -------- | --------------------------------------------------------------------------------------- |
| RPO       | 24 hours | Daily logical backups. Use a provider point-in-time-recovery interval if it is shorter. |
| RTO       | 4 hours  | Restore into an isolated target, apply migrations, and pass the remote smoke check.     |

These are targets, not guarantees, until measured in the operator's environment.

### Backup schedule

- Take one encrypted logical backup daily; retain 14 daily and 3 monthly copies.
- Check that the latest backup completed and is readable, for example with `pg_restore --list`, each day.
- Keep backups and keys in separate access domains.

### Isolated restore procedure

Never restore into production, and never run `pg_restore --clean` against a production database. Restore into a new isolated database or provider branch.

1. Create a new isolated database or provider branch with a migration-owner role and a separate runtime role. Do not reuse production endpoints.
2. Fetch the encrypted backup and its key from the approved store. Decrypt only on an operator-controlled host.
3. Restore the backup, for example `pg_restore --dbname "$RESTORE_DATABASE_URL" backup.dump`, or use the provider's branch restore. Keep ownership with the migration role.
4. Point `DATABASE_URL_UNPOOLED` at the restore target and run `npm run db:migrate`. It must exit 0.
5. Start the API against the restored target with `DATABASE_URL` set to the target's runtime role.
6. Run the remote smoke check against the restored non-production URL: `npm run smoke:remote -- https://restored-nonprod.example`. Require `liveness: ok`, `readiness: ok`, and `health: true`.
7. Record the date, operator, source backup, target, measured restore duration, migration result, and smoke result. Do not record connection strings, keys, or row contents.
8. Destroy the isolated target and any temporary decrypted files when the exercise ends.

If migrations fail, stop. Do not edit an applied migration to force a restore through; add a new forward-only migration instead.

### Restore exercise record

| Field            | Value                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Date             | 2026-11-23                                                                                              |
| Operator         | Repository maintainer (local verification)                                                              |
| Provider/target  | Local PostgreSQL 17.12, isolated database `aidtrace_restore_drill` (non-production)                     |
| Source           | Local development database after `npm run db:migrate`, plus one synthetic drill record                  |
| Backup format    | `pg_dump --format=custom`                                                                               |
| Restore duration | 113 ms measured with millisecond timestamps around `pg_restore`                                         |
| Restored rows    | 1 synthetic `aid_records` row matched after restore                                                     |
| Migrations       | `npm run db:migrate` exited 0                                                                           |
| Remote smoke     | `liveness: ok`, `readiness: ok`, `health: true` against `http://127.0.0.1:3101`                         |
| Outcome          | Success                                                                                                 |
| Data handling    | Synthetic data only; no beneficiary rows, credentials, or row contents printed; dump and target deleted |

This record covers a local isolated target because no hosted provider is configured. Re-run the exercise and replace this record when a hosted provider or production-like target is selected.

## Network selection

The UI/API support testnet and mainnet selection. Use testnet for development and tests. Mainnet verification reads public Horizon data, but the application does not send payments. Never describe a matching transaction as proof of identity, consent, intended use, or impact.

## Operations still required

Configure PostgreSQL network restrictions, monitoring, rate limits for public reads, and database readiness checks. Encrypted backups and the isolated restore procedure are documented above, but a hosted-provider backup and a production-like restore have not been exercised as part of this repository work. `/api/_healthcheck` reports process liveness only. Production hosting and browser cookie behavior have not been exercised.
