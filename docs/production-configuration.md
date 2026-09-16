# Production Configuration

This document defines the production configuration contract introduced in PR-1, runtime hardening added in PR-2, migration safety added in PR-3, durable private file storage added in PR-4, and backup/recovery controls added in PR-5. Provider-specific deployment still belongs to PR-6.

## Frontend and API routing

The recommended production topology is **same-origin routing**:

- The frontend is served from the public application origin, for example `https://app.example.com`.
- Requests under `/api` are reverse-proxied to the Express backend.
- `VITE_API_BASE_URL=/api` remains the frontend default, so local development and production can use the same API path.
- The production web server/platform must use SPA fallback routing so direct visits such as `/activate-account` and `/reset-password` serve `index.html` instead of returning 404.

If the frontend and API use different origins, set an absolute frontend API URL such as `VITE_API_BASE_URL=https://api.example.com/api`. In that topology, configure the backend `FRONTEND_URL` and optional `CORS_ORIGINS` whitelist to contain only the intended HTTPS frontend origins.

## Backend runtime

Production should set at least:

- `NODE_ENV=production`
- `PORT` when the hosting platform does not inject it automatically
- `FRONTEND_URL=https://...`
- `JWT_SECRET` with at least 32 characters
- a non-console `EMAIL_PROVIDER` and its provider credentials
- `FILE_STORAGE_ROOT` as an absolute path on a durable mounted volume
- `BACKUP_ROOT` as a separate absolute durable path
- `BACKUP_RETENTION_DAYS` according to the retention policy
- `TRUST_PROXY=true` only when Express is behind the trusted reverse proxy/load balancer expected by the deployment

Runtime controls introduced in PR-2:

- `LOG_LEVEL` controls structured application logging. Supported values are `debug`, `info`, `warn`, `error`, and `silent`.
- `READINESS_TIMEOUT_MS` limits how long `/ready` waits for PostgreSQL before returning `503`. The default is 3000 ms.
- `SHUTDOWN_TIMEOUT_MS` limits graceful shutdown before the process is forced to exit. The default is 10000 ms.

See `backend/.env.example` for the complete variable list.

## Health and readiness

The backend exposes two unauthenticated platform endpoints:

- `GET /health` is a liveness check. It verifies that the Express process is serving requests and does not depend on PostgreSQL.
- `GET /ready` is a readiness check. It executes a lightweight PostgreSQL query and returns `200` only when the database dependency is reachable. If the check fails or times out, it returns `503` without exposing database error details.

Use `/health` for liveness probes and `/ready` for traffic/readiness probes on the production platform.

## Error handling and logging

Unhandled API errors are converted to JSON by the final Express error handler. Explicit operational errors keep their existing status/message behavior, while unexpected `5xx` errors use a generic `Internal server error` response in production so internal exception details are not exposed to clients.

Runtime and unexpected server errors are written as structured JSON logs to standard output/error. Secrets and request bodies are not intentionally included in these runtime log events.

## Graceful shutdown

The production server listens for `SIGTERM` and `SIGINT`. During shutdown it:

1. stops accepting new HTTP connections,
2. waits for the HTTP server to close,
3. closes the PostgreSQL pool with `pool.end()`, and
4. exits successfully when cleanup completes.

If cleanup does not finish within `SHUTDOWN_TIMEOUT_MS`, the process exits with a failure code so the deployment platform cannot leave a stuck instance running indefinitely.

## PostgreSQL

SupplyFlow accepts either:

1. `DATABASE_URL`, which is convenient for managed PostgreSQL providers, or
2. the existing `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` variables.

TLS can be configured with `DB_SSL_MODE`:

- `disable` — intended for local development only and rejected by production validation.
- `require` — encrypts the connection without enforcing certificate verification.
- `verify-full` — encrypts the connection and verifies the server certificate. `DB_SSL_CA` can provide a custom CA when required by the database provider.

When `DATABASE_URL` already contains PostgreSQL SSL query parameters such as `sslmode`, do not also set `DB_SSL_MODE`. This avoids ambiguous node-postgres SSL configuration.

If production has no explicit SSL configuration, the backend defaults to `require`. Prefer `verify-full` when the managed database provider supplies a verifiable certificate chain.

## Private file storage

SupplyFlow stores payment proofs, user avatars, and supplier invoice attachments as private files. Their existing authenticated API endpoints remain unchanged; the frontend does not receive a public filesystem path.

Production must configure `FILE_STORAGE_ROOT` as an **absolute path on a durable mounted volume**. The backend creates these namespaces below that root:

- `payment-proofs/`
- `user-avatars/`
- `supplier-invoices/`

The backend performs a write/read/delete probe for every storage namespace before starting the HTTP listener. If the mount is missing, read-only, or otherwise unusable, startup fails instead of silently accepting uploads onto an ephemeral application filesystem.

Do not point `FILE_STORAGE_ROOT` at a container/image root directory that is discarded on redeploy. The deployment platform must mount storage whose lifecycle is independent from the API process.

For a single API instance, one durable mounted volume is sufficient. If the API is horizontally scaled, every instance must see the same shared persistent filesystem. A future object-storage adapter can be placed behind the same storage service boundary when a deployment requires fully stateless multi-instance storage.

For development and tests, leaving `FILE_STORAGE_ROOT` empty keeps the existing `backend/storage` default. `PAYMENT_PROOF_STORAGE_DIR`, `USER_AVATAR_STORAGE_DIR`, and `SUPPLIER_INVOICE_STORAGE_DIR` remain available as legacy development/test overrides. When `FILE_STORAGE_ROOT` is configured by normal server startup, it takes precedence and maps all three namespaces under the central root.

## Backup and recovery

Production must configure `BACKUP_ROOT` as an absolute path separate from `FILE_STORAGE_ROOT`. Nested backup/live-storage paths are rejected to avoid recursive backups and accidental deletion through retention cleanup.

SupplyFlow provides:

- `npm run backup:create -- --maintenance`
- `npm run backup:verify -- <backup-directory>`
- `npm run backup:restore -- <backup-directory> --confirm-restore --maintenance`

Backup bundles contain a PostgreSQL custom-format dump, all private file namespaces, and a SHA-256 manifest. Production create/restore commands require the explicit `--maintenance` assertion because application-level database and filesystem snapshots are only consistent when writes are stopped.

`BACKUP_RETENTION_DAYS` controls automatic cleanup after a successful backup and defaults to 14 in the command. `PG_DUMP_BIN` and `PG_RESTORE_BIN` can override PostgreSQL client executable locations.

Completed bundles should be copied to a separate failure domain/off-host location. Keeping the only backup on the same machine or physical storage as the live application does not provide disaster recovery.

See `docs/backup-recovery.md` for the full creation, verification, restore, rollback, retention, and recovery-drill runbook.
