# Vercel Live Demo Deployment

This runbook describes the provider-specific live-demo deployment introduced in PR-6B. It intentionally uses one repository and separate frontend/backend Vercel projects.

## Target topology

```text
GitHub repository
├─ Vercel project: frontend (root: frontend)
│  └─ React/Vite SPA
└─ Vercel project: backend (root: backend)
   ├─ Neon PostgreSQL
   ├─ Vercel Private Blob
   └─ Resend
```

No custom domain is required. The Vercel-generated frontend and backend URLs are sufficient for the portfolio demo.

## 1. Neon

Create a dedicated demo database. Do not reuse the local development database or any real production database.

Keep two connection strings:

- `DATABASE_URL`: the pooled Neon connection string used by the HTTP API.
- `DATABASE_URL_UNPOOLED`: the direct/unpooled connection string used by operator jobs such as migrations and the demo reset.

After the database exists, run the tracked migrations from an operator environment and confirm:

```bash
npm run migrate
npm run migrate:status
```

The existing legacy baseline must not be recreated. Migration history remains in `app.schema_migrations`.

## 2. Vercel Private Blob

Create/connect a **private** Blob store to the backend Vercel project.

The HTTP backend uses project authentication/OIDC when no static token is supplied. Objects are stored under:

```text
<BLOB_PATH_PREFIX>/payment-proofs/
<BLOB_PATH_PREFIX>/user-avatars/
<BLOB_PATH_PREFIX>/supplier-invoices/
```

The database continues to store only the generated UUID filename. Downloads still flow through SupplyFlow's authenticated API routes, preserving existing RBAC.

The external GitHub Actions demo-reset runner cannot rely on the backend project's runtime OIDC context, so configure a Blob read/write token as the repository secret `DEMO_BLOB_READ_WRITE_TOKEN` for that workflow.

## 3. Backend Vercel project

Set the project root to `backend`.

Required live-demo environment values:

```env
NODE_ENV=production
DEPLOYMENT_TARGET=vercel
DEMO_MODE=true
DEMO_RESET_ENABLED=false

DATABASE_URL=<Neon pooled URL>
DATABASE_URL_UNPOOLED=<Neon direct URL>
DB_SSL_MODE=
DB_POOL_MAX=3
DB_IDLE_TIMEOUT_MS=10000
DB_CONNECTION_TIMEOUT_MS=5000

JWT_SECRET=<random secret, at least 32 characters>
JWT_EXPIRES_IN=8h

FRONTEND_URL=https://<frontend-project>.vercel.app
CORS_ORIGINS=
TRUST_PROXY=true

FILE_STORAGE_PROVIDER=vercel-blob
BLOB_PATH_PREFIX=supplyflow/demo

EMAIL_PROVIDER=resend
RESEND_API_KEY=<Resend API key>
EMAIL_FROM=<verified Resend sender>

LOG_LEVEL=info
READINESS_TIMEOUT_MS=3000
SHUTDOWN_TIMEOUT_MS=10000
```

`FILE_STORAGE_ROOT` and `BACKUP_ROOT` are not required by the Vercel HTTP runtime because live files use Private Blob. Traditional production hosts can continue to use the existing filesystem provider and backup workflow.

Payment-proof and supplier-invoice uploads are capped at 4 MB per file on the Vercel server path so multipart requests stay below the platform request-body ceiling. Avatar uploads remain capped at 2 MB.

## 4. Frontend Vercel project

Set the project root to `frontend`.

Configure:

```env
VITE_API_BASE_URL=https://<backend-project>.vercel.app/api
VITE_DEMO_MODE=true
VITE_DEMO_PASSWORD=<same shared password used by demo accounts>
```

`frontend/vercel.json` supplies SPA fallback routing so direct visits to React Router paths load `index.html`.

`VITE_DEMO_PASSWORD` is intentionally public and must only be used for the restricted `demo_*` accounts. Never reuse it for real credentials.

## 5. Resend

The backend already sends authentication email through the Resend HTTP API when `EMAIL_PROVIDER=resend`.

The live demo blocks invitation/password-recovery mutations through demo safety rules, but the provider remains configured so the same build can be used for a real non-demo installation where those flows are enabled.

## 6. Shared demo reset

Configure GitHub repository settings before enabling the schedule.

Variables:

```text
DEMO_RESET_ENABLED=true
DEMO_DATABASE_NAME=<exact Neon demo database name>
DEMO_BLOB_PATH_PREFIX=supplyflow/demo
```

Secrets:

```text
DEMO_DATABASE_URL_UNPOOLED=<Neon direct connection URL>
DEMO_ACCOUNT_PASSWORD=<shared public demo password>
DEMO_BLOB_READ_WRITE_TOKEN=<Blob read/write token for GitHub Actions>
```

The workflow remains inert while `DEMO_RESET_ENABLED` is not `true`.

The reset preserves `app.schema_migrations`, reseeds deterministic demo accounts/data, and clears only the configured SupplyFlow Blob namespaces. Scheduled workflow execution can be delayed, so UI copy should describe reset timing as approximate.

## 7. Operator commands

Migrations and reset are operator jobs, not normal HTTP requests:

```bash
npm run migrate
npm run migrate:status
npm run demo:reset
```

When `DATABASE_URL_UNPOOLED` is present, migration and reset scripts prefer it automatically.

The PR-5 filesystem backup create/restore workflow remains supported for `FILE_STORAGE_PROVIDER=filesystem`. Blob-backed demo deployments use the deterministic demo reset path; `backup:create` and `backup:restore` intentionally reject non-filesystem application storage instead of producing an incomplete backup.

## 8. Deployment verification

After both Vercel projects are deployed, verify at minimum:

1. `GET /health` returns `200`.
2. `GET /ready` returns `200` with Neon reachable.
3. The frontend login page can reach the backend origin.
4. All six demo roles can sign in.
5. Each role sees the expected RBAC navigation and API access.
6. Own-avatar upload/read/delete works through Private Blob.
7. Payment proof and supplier invoice attachment upload/read/delete work.
8. Demo-sensitive account/configuration actions return `403`.
9. A manual demo-reset workflow returns the database and Blob files to baseline.
10. Direct navigation to frontend routes such as `/profile` loads successfully.
