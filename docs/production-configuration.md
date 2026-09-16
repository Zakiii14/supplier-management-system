# Production Configuration

This document defines SupplyFlow's runtime configuration contract through PR-6B: production environment validation, runtime hardening, tracked migrations, private storage, backup/recovery, demo safety, and provider-specific Vercel adaptation.

## Frontend and API routing

SupplyFlow supports either same-origin routing or separate frontend/API origins.

For the Vercel portfolio demo, frontend and backend are separate Vercel projects from the same repository. Configure:

```env
# frontend
VITE_API_BASE_URL=https://<backend-project>.vercel.app/api

# backend
FRONTEND_URL=https://<frontend-project>.vercel.app
```

The backend CORS whitelist uses `FRONTEND_URL` plus optional comma-separated `CORS_ORIGINS`. Production origins must be HTTPS.

The Vite frontend includes SPA fallback routing through `frontend/vercel.json`, so direct visits to React Router URLs resolve to `index.html`.

## Deployment target

`DEPLOYMENT_TARGET` selects runtime expectations:

- `node` — traditional Node host/container/VM.
- `vercel` — Vercel Functions/Fluid compute.

When the Vercel platform injects `VERCEL=1`, the runtime also recognizes the Vercel target automatically. Setting `DEPLOYMENT_TARGET=vercel` explicitly is still recommended in deployment configuration.

## Backend runtime

Production should set at least:

- `NODE_ENV=production`
- `DEPLOYMENT_TARGET`
- `FRONTEND_URL=https://...`
- `JWT_SECRET` with at least 32 characters
- `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM`
- a supported private file-storage provider
- PostgreSQL connection configuration
- `TRUST_PROXY=true` only behind the trusted deployment proxy expected by the application

Runtime controls:

- `LOG_LEVEL`: `debug`, `info`, `warn`, `error`, or `silent`
- `READINESS_TIMEOUT_MS`: PostgreSQL readiness timeout
- `SHUTDOWN_TIMEOUT_MS`: traditional Node graceful-shutdown timeout

See `backend/.env.example` for the complete variable list.

## Health and readiness

The backend exposes:

- `GET /health` — liveness, independent of PostgreSQL
- `GET /ready` — readiness, verifies PostgreSQL connectivity and returns `503` on failure without exposing database internals

## Error handling and logging

Unexpected production `5xx` errors are converted to a generic `Internal server error` response. Explicit operational status/messages remain available to clients. Runtime events are written as structured logs without intentionally logging secrets or request bodies.

## PostgreSQL

SupplyFlow accepts either `DATABASE_URL` or the discrete `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` variables.

For Neon/Vercel:

- `DATABASE_URL` should be the pooled connection URL used by the HTTP API.
- `DATABASE_URL_UNPOOLED` can hold the direct connection URL used by migration/reset/backup operator commands.

When `DATABASE_URL_UNPOOLED` is present, tracked migration and demo-reset scripts prefer it automatically.

Serverless pool controls:

- `DB_POOL_MAX` — defaults to 3 on Vercel and 10 otherwise
- `DB_IDLE_TIMEOUT_MS` — defaults to 10000
- `DB_CONNECTION_TIMEOUT_MS` — defaults to 5000

TLS can be configured with `DB_SSL_MODE=disable|require|verify-full`. `disable` is rejected in production. When `DATABASE_URL` already contains PostgreSQL SSL query parameters such as `sslmode`, leave `DB_SSL_MODE` empty.

## Private file storage

`FILE_STORAGE_PROVIDER` supports:

- `filesystem`
- `vercel-blob`

The same logical namespaces are preserved across providers:

- `payment-proofs`
- `user-avatars`
- `supplier-invoices`

Database rows continue to store generated UUID filenames rather than provider URLs. Reads remain behind authenticated SupplyFlow routes, so existing RBAC remains the access boundary.

### Filesystem provider

Filesystem is the default for local development and remains supported for traditional production hosts.

Production filesystem deployments require:

```env
FILE_STORAGE_PROVIDER=filesystem
FILE_STORAGE_ROOT=/absolute/durable/storage
BACKUP_ROOT=/absolute/separate/backup/storage
```

SupplyFlow performs local write/read/delete storage probes before starting the traditional Node listener.

### Vercel Private Blob provider

Vercel production requires:

```env
DEPLOYMENT_TARGET=vercel
FILE_STORAGE_PROVIDER=vercel-blob
BLOB_PATH_PREFIX=supplyflow/demo
```

The backend uses Private Blob for uploaded files. A Vercel-linked private store can authenticate through project OIDC, so a static `BLOB_READ_WRITE_TOKEN` is not required by the HTTP runtime. External operators such as GitHub Actions must provide a Blob token explicitly.

Files are placed under `<BLOB_PATH_PREFIX>/<namespace>/<uuid filename>`.

Vercel server uploads use a 4 MB per-file ceiling for payment proofs and supplier invoice attachments so multipart requests stay below the platform request-body limit. Avatar uploads retain the existing 2 MB limit.

## Email

Local development may use `EMAIL_PROVIDER=console`. Production rejects the console provider.

Resend configuration:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=...
EMAIL_FROM=SupplyFlow <verified-sender@example.com>
```

Activation and reset URLs are generated from `FRONTEND_URL`.

## Backup and recovery

The PR-5 backup bundle workflow remains the supported backup/restore mechanism for `FILE_STORAGE_PROVIDER=filesystem`:

```bash
npm run backup:create -- --maintenance
npm run backup:verify -- <backup-directory>
npm run backup:restore -- <backup-directory> --confirm-restore --maintenance
```

`backup:create` and `backup:restore` intentionally reject non-filesystem application storage rather than create an incomplete bundle. `backup:verify` can still verify an existing bundle.

The portfolio live demo uses a deterministic shared-demo reset for both Neon data and Blob files. This reset is not a replacement for disaster recovery in a future real Blob-backed commercial deployment; a provider-aware object-storage backup workflow would be required for that topology.

See `docs/backup-recovery.md` and `docs/vercel-demo-deployment.md`.

## Demo mode

Demo behavior is controlled independently from provider selection:

```env
DEMO_MODE=true
DEMO_RESET_ENABLED=true
```

Real installations keep both disabled. `VITE_DEMO_MODE=false` hides the frontend demo login surface.

See `docs/demo-mode.md` for demo accounts, restrictions, reset safeguards, and GitHub Actions configuration.
