# Database Migration Safety

PR-3 introduces tracked, ordered PostgreSQL migrations for SupplyFlow.

## Migration history

Migration files live in `database/migrations` and must use contiguous numeric names such as:

```text
001_code_number_settings.sql
002_payment_tracking_and_proofs.sql
...
021_next_change.sql
```

Do not rename, delete, or edit an applied migration. The runner stores a SHA-256 checksum in `app.schema_migrations` and refuses to continue when applied history differs from the repository.

## Commands

Run commands from `backend`:

```powershell
npm run migrate:status
npm run migrate:baseline
npm run migrate
```

Use another environment file when needed:

```powershell
npm run migrate:status -- --env=.env.test
npm run migrate:baseline -- --env=.env.test
npm run migrate -- --env=.env.test
```

`migrate` no longer accepts one SQL filename. It always discovers the migration directory and applies every pending migration in numeric order.

## Existing databases and legacy baseline

Migrations `001` through `020` existed before migration tracking was introduced. `database/migration-baseline.json` pins that legacy cutoff at version `20`.

For an existing development, test, or production database that already contains the current SupplyFlow schema:

1. Run `npm run migrate:status` and confirm it reports that migration tracking is not initialized.
2. Verify the database was already updated through legacy migration `020` or was initialized from the current `database/schema.sql` snapshot.
3. Run `npm run migrate:baseline` once. This creates `app.schema_migrations` and records only migrations `001`-`020` as baseline records without executing their SQL again.
4. Run `npm run migrate:status` again.
5. Use only `npm run migrate` for future migrations.

The baseline cutoff is intentionally fixed. A future migration such as `021_...sql` is never silently marked as applied by the legacy baseline command.

## New database bootstrap

The migration runner expects the core `app` schema to exist. Initialize a new database from `database/schema.sql` first, then create the legacy baseline and run pending migrations:

```powershell
npm run migrate:baseline
npm run migrate
```

If the schema snapshot is refreshed in the future, update the baseline policy deliberately rather than changing historical migration records implicitly.

## Runtime safeguards

The runner provides these protections:

- a PostgreSQL advisory lock prevents two migration runners from executing concurrently;
- every migration and its `schema_migrations` insert run in the same transaction;
- failed migrations roll back and are not recorded as applied;
- migration versions must be contiguous and unique;
- applied filenames and SHA-256 checksums must still match the repository;
- a gap in recorded migration history stops execution;
- an existing database with no tracking table refuses normal migration execution until the explicit baseline step is completed.

## Creating the next migration

Create a new SQL file using the next contiguous version. After version `020`, for example:

```text
021_add_example_feature.sql
```

Never modify `020_security_hardening.sql` to add a new change after it has been baselined or applied. Put the change in a new migration instead.
