const {
  validateMigrationHistory,
} = require("./migrationFiles");
const {
  createTrackingTable,
  getAppliedMigrations,
  insertMigrationRecord,
  readDatabaseState,
  withMigrationLock,
} = require("./migrationState");

const assertCoreSchemaExists = (databaseState) => {
  if (!databaseState.has_core_schema) {
    throw new Error(
      "Base database schema is missing. Initialize from database/schema.sql before using the migration runner.",
    );
  }
};

const baselineLegacyMigrations = async ({
  client,
  migrations,
  baselineVersion,
}) =>
  withMigrationLock(client, async () => {
    const state = await readDatabaseState(client);
    assertCoreSchemaExists(state);

    if (!state.has_tracking_table) {
      await createTrackingTable(client);
    }

    const applied = await getAppliedMigrations(client);
    if (applied.length > 0) {
      throw new Error(
        "Migration baseline can only be created when schema_migrations has no records.",
      );
    }

    const baselineMigrations = migrations.filter(
      (migration) => migration.version <= baselineVersion,
    );
    const highest = baselineMigrations.at(-1);
    if (!highest || highest.version !== baselineVersion) {
      throw new Error(
        `Configured baseline version ${baselineVersion} does not exist in the migration directory.`,
      );
    }

    await client.query("BEGIN");
    try {
      for (const migration of baselineMigrations) {
        await insertMigrationRecord(client, migration, { isBaseline: true });
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    return baselineMigrations;
  });

const applyPendingMigrations = async ({ client, migrations }) =>
  withMigrationLock(client, async () => {
    const state = await readDatabaseState(client);
    assertCoreSchemaExists(state);

    if (!state.has_tracking_table) {
      throw new Error(
        "Migration tracking is not initialized. Run `npm run migrate:baseline` once before applying pending migrations.",
      );
    }

    const applied = await getAppliedMigrations(client);
    const pending = validateMigrationHistory(migrations, applied);
    const appliedNow = [];

    for (const migration of pending) {
      const startedAt = process.hrtime.bigint();
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        const executionMs = Number(
          (process.hrtime.bigint() - startedAt) / BigInt(1_000_000),
        );
        await insertMigrationRecord(client, migration, { executionMs });
        await client.query("COMMIT");
        appliedNow.push({ ...migration, executionMs });
      } catch (error) {
        await client.query("ROLLBACK");
        const wrapped = new Error(
          `Migration ${migration.filename} failed: ${error.message}`,
        );
        wrapped.cause = error;
        throw wrapped;
      }
    }

    return appliedNow;
  });

const getMigrationStatus = async ({ client, migrations }) => {
  const state = await readDatabaseState(client);
  if (!state.has_core_schema) {
    return {
      ...state,
      appliedMigrations: [],
      pendingMigrations: migrations,
      historyValid: false,
      message: "Base database schema is missing.",
    };
  }
  if (!state.has_tracking_table) {
    return {
      ...state,
      appliedMigrations: [],
      pendingMigrations: migrations,
      historyValid: false,
      message: "Migration tracking is not initialized; baseline is required.",
    };
  }

  const appliedMigrations = await getAppliedMigrations(client);
  const pendingMigrations = validateMigrationHistory(
    migrations,
    appliedMigrations,
  );

  return {
    ...state,
    appliedMigrations,
    pendingMigrations,
    historyValid: true,
    message: pendingMigrations.length
      ? `${pendingMigrations.length} migration(s) pending.`
      : "Database migration history is up to date.",
  };
};

module.exports = {
  applyPendingMigrations,
  baselineLegacyMigrations,
  getMigrationStatus,
};
