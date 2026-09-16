# Shared Live Demo

SupplyFlow uses one shared demo database for portfolio testing. The demo is intentionally collaborative: visitors using different roles see the same company data.

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

The reset obtains a PostgreSQL advisory lock, truncates application tables except `app.schema_migrations`, reseeds configuration/accounts/demo data in one transaction, and then removes only files that existed before that reset started.

The shared demo workflow is scheduled every 15 minutes. Scheduled GitHub Actions can start late, so the UI should describe the reset interval as approximate rather than promise an exact countdown.

## GitHub Actions activation

The workflow stays inert until repository variable `DEMO_RESET_ENABLED` is set to `true`.

Required repository configuration:

- Variable `DEMO_RESET_ENABLED=true`
- Variable `DEMO_DATABASE_NAME=<dedicated demo database name>`
- Secret `DEMO_DATABASE_URL=<demo PostgreSQL connection string>`
- Secret `DEMO_ACCOUNT_PASSWORD=<shared demo password>`

Do not point these values at development or real production databases.

## Production installations

For a real installation:

```env
DEMO_MODE=false
DEMO_RESET_ENABLED=false
VITE_DEMO_MODE=false
```

The demo login surface, demo restrictions, and scheduled reset are not part of the real production experience.
