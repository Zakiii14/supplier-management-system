# Production Configuration

This document defines the deployment configuration contract introduced in PR-1. It does not configure a specific hosting provider yet; provider-specific deployment belongs to PR-6.

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

See `backend/.env.example` for the complete variable list.

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
