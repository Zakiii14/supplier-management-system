# Production Configuration

This document defines the deployment configuration contract introduced in PR-1 and the runtime hardening added in PR-2. It does not configure a specific hosting provider yet; provider-specific deployment belongs to PR-6.

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

## Local file storage

`PAYMENT_PROOF_STORAGE_DIR`, `USER_AVATAR_STORAGE_DIR`, and `SUPPLIER_INVOICE_STORAGE_DIR` remain supported for the current local-filesystem implementation. They are documented here only for configuration completeness. Moving uploads to production-grade object storage is intentionally deferred to PR-4.
