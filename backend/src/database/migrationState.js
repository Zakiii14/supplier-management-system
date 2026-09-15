const TRACKING_TABLE = "app.schema_migrations";
const MIGRATION_LOCK_NAME = "supplyflow_schema_migrations_v1";

const readDatabaseState = async (client) => {
  const result = await client.query(`
    SELECT
      to_regclass('app.users') IS NOT NULL AS has_core_schema,
      to_regclass('${TRACKING_TABLE}') IS NOT NULL AS has_tracking_table
  `);
  return result.rows[0];
};

const createTrackingTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      version INTEGER PRIMARY KEY CHECK (version > 0),
      filename TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL CHECK (length(checksum) = 64),
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      execution_ms INTEGER NOT NULL DEFAULT 0 CHECK (execution_ms >= 0),
      is_baseline BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
};

const getAppliedMigrations = async (client) => {
  const result = await client.query(`
    SELECT version, filename, checksum, applied_at, execution_ms, is_baseline
    FROM ${TRACKING_TABLE}
    ORDER BY version ASC
  `);

  return result.rows.map((row) => ({
    ...row,
    version: Number(row.version),
  }));
};

const insertMigrationRecord = async (
  client,
  migration,
  { executionMs = 0, isBaseline = false } = {},
) => {
  await client.query(
    `
      INSERT INTO ${TRACKING_TABLE}
        (version, filename, checksum, execution_ms, is_baseline)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      migration.version,
      migration.filename,
      migration.checksum,
      executionMs,
      isBaseline,
    ],
  );
};

const acquireMigrationLock = async (client) => {
  await client.query("SELECT pg_advisory_lock(hashtext($1))", [
    MIGRATION_LOCK_NAME,
  ]);
};

const releaseMigrationLock = async (client) => {
  await client.query("SELECT pg_advisory_unlock(hashtext($1))", [
    MIGRATION_LOCK_NAME,
  ]);
};

const withMigrationLock = async (client, callback) => {
  await acquireMigrationLock(client);
  try {
    return await callback();
  } finally {
    await releaseMigrationLock(client);
  }
};

module.exports = {
  MIGRATION_LOCK_NAME,
  TRACKING_TABLE,
  createTrackingTable,
  getAppliedMigrations,
  insertMigrationRecord,
  readDatabaseState,
  withMigrationLock,
};
