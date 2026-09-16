# Shared Live Demo

SupplyFlow uses one shared demo database for portfolio testing. The demo is intentionally collaborative: visitors using different roles see the same fictional company data.

## Required demo environment

Backend:

```env
DEMO_MODE=true
DEMO_RESET_ENABLED=true
DEMO_DATABASE_NAME=<dedicated demo database name>
DEMO_ACCOUNT_PASSWORD=<shared public demo password>
```

Frontend:

```env
VITE_DEMO_MODE=true
VITE_DEMO_PASSWORD=<same shared public demo password>
```

`DEMO_ACCOUNT_PASSWORD` / `VITE_DEMO_PASSWORD` is intentionally public because it only authenticates restricted demo accounts. It must never be reused for a real account.

## Demo accounts

- `demo_admin`
- `demo_purchasing`
- `demo_warehouse`
- `demo_sales`
- `demo_finance`
- `demo_manager`

All accounts are reseeded with deterministic UUIDs so role identity remains stable after each reset.

## Reset safety

`npm run demo:reset` refuses to run unless all of the following are true:

1. `DEMO_MODE=true`
2. `DEMO_RESET_ENABLED=true`
3. `DEMO_DATABASE_NAME` exactly matches PostgreSQL `current_database()`
4. `DEMO_ACCOUNT_PASSWORD` is at least 8 characters

The reset obtains a PostgreSQL advisory lock, truncates application tables except `app.schema_migrations`, reseeds configuration/accounts/demo data in one transaction, and then removes the files that existed in the configured application-storage namespaces when the reset started.

Storage clearing uses the active storage provider. Local/traditional deployments use the filesystem adapter, while the Vercel live demo uses Private Blob.

The shared demo workflow is scheduled approximately every 15 minutes. Scheduled GitHub Actions can start late, so the UI must describe the interval as approximate rather than promise an exact countdown.

## GitHub Actions activation

The workflow stays inert until repository variable `DEMO_RESET_ENABLED` is set to `true`.

Required repository variables:

- `DEMO_RESET_ENABLED=true`
- `DEMO_DATABASE_NAME=<dedicated demo database name>`
- `DEMO_BLOB_PATH_PREFIX=supplyflow/demo`

Required repository secrets:

- `DEMO_DATABASE_URL_UNPOOLED=<direct demo PostgreSQL connection string>`
- `DEMO_ACCOUNT_PASSWORD=<shared demo password>`
- `DEMO_BLOB_READ_WRITE_TOKEN=<Blob token used only by the external GitHub runner>`

Do not point these values at development or real production databases. Do not reuse the Blob prefix used by another installation.

## Public demo restrictions

When `DEMO_MODE=true`, server-side protection blocks sensitive mutations such as user creation/invitation/password administration, global numbering/tax/payment settings changes, and master-data import writes. Normal business workflows remain available according to RBAC, and each demo user can manage only their own profile avatar.

Frontend hiding is not treated as a security boundary; restricted actions are rejected by the backend.

## Production installations

For a real installation:

```env
DEMO_MODE=false
DEMO_RESET_ENABLED=false
VITE_DEMO_MODE=false
```

The demo login surface, demo restrictions, and scheduled reset are not part of the real production experience.

See `docs/vercel-demo-deployment.md` for the provider-specific Vercel + Neon + Private Blob + Resend deployment runbook.
