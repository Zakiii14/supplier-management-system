# Shared demo sessions

Local/full-access installs keep `DEMO_MODE=false` and
`DEMO_RESET_ENABLED=false`. Demo tests use a disposable PostgreSQL database,
not Neon or the shared Blob store.

## Session contract

- In demo mode, login requires a UUID `client_id`. Successful login atomically
  verifies credentials and registers a fresh `session_id`, then issues a JWT
  containing both IDs. A failed registration never returns a usable login.
- Heartbeat only updates an existing, unexpired session belonging to that JWT.
  It cannot create a session or reopen logout. Re-login rotates the session ID
  so a delayed old logout/heartbeat cannot change the new session.
- Login, heartbeat, logout and the reset decision all use the same PostgreSQL
  transaction advisory lock. This supports Neon's transaction pooler and
  releases the lock on rollback/disconnection. Cleanup rechecks state after
  obtaining the lock; two concurrent cleanup requests cannot reset twice.
- Explicit logout only ends the session; it does not reset immediately. The
  database is protected for `DEMO_IDLE_MINUTES` (default 15) after the most
  recent session activity, so another role can continue a workflow after the
  previous role logs out. A closed tab stops sending heartbeat and becomes
  reset-eligible after the same inactivity window. The scheduled check runs
  every five minutes, subject to GitHub scheduling delays; this is not an exact
  wall-clock cleanup guarantee.
- A browser's demo authentication and last interaction time live in
  `sessionStorage`, separate from persistent full-access authentication.
  Refresh and profile updates preserve the idle deadline. Web Locks prevent
  duplicate tabs from sharing a copied session identity. Browsers without Web
  Locks require a fresh demo login on page load.
- A hidden tab does not send heartbeat. A visible idle tab ends at its local
  inactivity deadline. Failed end requests fall back to stale-session cleanup.
- Backend session expiry is enforced on authenticated requests, including old
  JWTs issued before a reset. Local/full-access JWT behavior is unchanged.

## Database and storage safeguards

Migration 021 adds only the session table and index; it is applied transactionally
and tracked by the existing migration runner. It has not been released yet and
includes `session_id`. Never manually reapply it if already tracked: inspect
migration status/checksums first.

Reset checks the connected database name against `DEMO_DATABASE_NAME` and requires
both demo flags. It excludes `app.schema_migrations`, rejects that table if passed
explicitly, and uses TRUNCATE without CASCADE so unexpected external dependencies
fail safely. The integration tests compare every migration-history field before
and after committed resets.

Blob cleanup captures old file names before reset and deletes only those names
after commit, preserving new uploads. If storage deletion fails after commit,
the database reset remains successful, `storageCleanupFailed` is returned, and
`demo_storage_cleanup_failed` is logged for operator cleanup. Database rollback
cannot undo Blob deletion; deletion is therefore never performed before commit.

## Validation

`Test SupplyFlow` runs PostgreSQL 18 in GitHub Actions, restores the schema,
baselines 001–020, seeds their original configuration defaults into the test
database, applies 021 twice (the second run must do nothing), runs all
backend tests, and runs frontend tests, lint and build. Session integration tests
create a separate temporary database and drop it afterward. Test credentials are
only for the disposable CI service. No production credentials are needed.

## Production rollout — not performed by this change

1. Review passing tests and the PR before merging.
2. Hold automatic production promotion until migration 021 is applied to the
   dedicated Neon demo database with the existing migration runner and an
   unpooled connection. Keep reset disabled during rollout. Do not publish the
   new demo backend against an unmigrated database.
3. Set repository variable `DEMO_API_URL` to the demo API URL. The cleanup
   workflow uses no database/Blob credentials. Ensure the previous scheduled
   direct-reset workflow is no longer running when switching mechanisms.
4. Configure backend `DEMO_MODE=true`, `DEMO_DATABASE_NAME=supplyflow_demo`,
   `DEMO_IDLE_MINUTES=15`, plus existing database/demo-account/Blob settings.
   Deploy backend and frontend together; frontend requires `VITE_DEMO_MODE=true`.
   Pre-change demo tokens require a fresh login under the new session contract.
5. Enable `DEMO_RESET_ENABLED=true` on the backend only after migration and
   deployment verification. Full-access/local settings stay false.
6. Verify logout, 15-minute inactivity, close-tab expiry, and two independent
   visitors. One visitor's logout must preserve the other's work. Inspect the
   cleanup result and migration history without disclosing credentials.
