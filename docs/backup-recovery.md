# Backup and Recovery

PR-5 adds a provider-agnostic backup and restore workflow for SupplyFlow. A backup bundle contains both the PostgreSQL database and every private file namespace so recovery does not depend on reconstructing one side manually.

## Backup bundle format

Each completed backup is stored below `BACKUP_ROOT` in a directory named like:

`SupplyFlow-YYYYMMDDTHHMMSSZ-<id>`

The actual prefix is lowercase `supplyflow-`. A bundle contains:

- `database.dump` — PostgreSQL custom-format dump created with `pg_dump --format=custom`.
- `files/payment-proofs/`
- `files/user-avatars/`
- `files/supplier-invoices/`
- `manifest.json` — format version, creation time, consistency mode, file sizes, and SHA-256 checksums.

Incomplete backups use a hidden `.incomplete` directory and are removed automatically when creation fails. A bundle is renamed to its final name only after its database dump and storage snapshot pass checksum verification.

## Required production configuration

Production must configure:

- `BACKUP_ROOT` — absolute path on durable storage, separate from `FILE_STORAGE_ROOT`.
- `BACKUP_RETENTION_DAYS` — positive integer; defaults to 14 when the backup command runs.
- `PG_DUMP_BIN` and `PG_RESTORE_BIN` only when PostgreSQL client tools are not available as `pg_dump` and `pg_restore` on `PATH`.

`BACKUP_ROOT` must not be inside `FILE_STORAGE_ROOT`, and `FILE_STORAGE_ROOT` must not be inside `BACKUP_ROOT`. This prevents recursive snapshots and accidental coupling of live files with backup retention cleanup.

The machine/container running backup commands must have PostgreSQL client tools compatible with the production PostgreSQL server. The backup process reuses `DATABASE_URL` or the `DB_*` variables and the configured PostgreSQL TLS mode. Database passwords are not passed on the command line; the backup process creates a temporary restricted PostgreSQL password file and removes it after the command completes. `DB_SSL_CA` is likewise written only to a temporary restricted file when needed and removed afterwards.

## Creating a backup

For local development:

```powershell
cd backend
npm run backup:create
```

If `BACKUP_ROOT` is not configured locally, backups default to `backend/backups`, which is ignored by Git.

For production, stop application writes first, then run:

```powershell
npm run backup:create -- --maintenance
```

Production backup creation refuses to run without `--maintenance`. The flag is an explicit operator assertion that writes have been stopped or the application has been placed in a maintenance/read-only state. This is necessary because the PostgreSQL dump and filesystem snapshot cannot be made transactionally atomic with each other by this application-level tool.

After a successful backup, valid bundles older than `BACKUP_RETENTION_DAYS` are deleted. Invalid/unreadable bundles are preserved for manual investigation instead of being automatically deleted.

## Verifying a backup

Verification is read-only and can be run at any time:

```powershell
npm run backup:verify -- "D:\path\to\supplyflow-20260916T000000Z-abcdef12"
```

Verification recalculates the database dump and every private file SHA-256 checksum and compares sizes against `manifest.json`. Missing, modified, duplicate, or untracked storage files cause verification to fail.

Run verification after copying a bundle to another server, volume, or object-storage archive. A checksum-valid local backup on the same physical volume as production data is not sufficient disaster recovery; completed bundles should also be replicated off-host according to the deployment provider's backup policy.

## Restoring

Restore is destructive. Stop the application/API before restoring so no process writes to the database or file storage during recovery.

First verify the bundle:

```powershell
npm run backup:verify -- "D:\path\to\backup"
```

Then restore locally with explicit confirmation:

```powershell
npm run backup:restore -- "D:\path\to\backup" --confirm-restore
```

Production additionally requires the maintenance assertion:

```powershell
npm run backup:restore -- "D:\path\to\backup" --confirm-restore --maintenance
```

The restore workflow:

1. verifies every checksum and rejects untracked files before changing live data,
2. stages all file namespaces beside their live directories,
3. atomically swaps the staged file directories while preserving the previous directories,
4. runs `pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error`,
5. rolls the file directories back if the database restore fails, and
6. deletes the preserved pre-restore file directories only after the database restore succeeds.

`--single-transaction` makes the PostgreSQL restore all-or-nothing, so a failed `pg_restore` does not intentionally leave a partially restored database. Combined with the file-directory rollback, this keeps the two recovery sides aligned as far as the application-level recovery workflow can guarantee.

After restore, before reopening traffic:

```powershell
npm run migrate:status
```

If the restored backup predates newer application migrations, apply them with:

```powershell
npm run migrate
```

Then run the production smoke checks from the deployment runbook before enabling traffic.

## Recovery drill

A backup process is not considered proven until restore has been tested. Periodically perform a recovery drill against an isolated PostgreSQL database and isolated file-storage directory:

1. copy a recent backup to the recovery environment,
2. run `backup:verify`,
3. restore using recovery-only database/storage settings,
4. run `migrate:status`,
5. start the API and confirm `/health` and `/ready`,
6. log in with a recovery test account,
7. open at least one payment proof, avatar, and supplier invoice attachment, and
8. record the date, backup identifier, and result of the drill.

Never test a restore against the production database merely to validate the procedure.

## Scheduling and retention recommendation

A practical starting policy for SupplyFlow is:

- create one backup every day during the lowest-write period,
- retain at least 14 daily bundles locally,
- replicate completed bundles to a separate failure domain/off-host location,
- keep additional weekly/monthly copies according to business requirements,
- run checksum verification on replicated copies, and
- run a restore drill regularly and after material database/storage changes.

Provider-specific scheduling, encrypted off-host replication, secrets injection, and deployment automation are finalized in PR-6 because those details depend on the selected hosting platform.
