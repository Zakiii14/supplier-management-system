const {
  getApplicationStorageTargets,
} = require("../services/fileStorageService");
const {
  seedDemoDatabase,
} = require("./demoSeed");

const { DEMO_RESET_LOCK_KEY, lockDemoTransaction } = require("./demoTransaction");
const logger = require("../utils/logger");

const quoteIdentifier = (value) =>
  `"${String(value).replace(/"/g, "\"\"")}"`;

const getCurrentDatabaseName = async (client) => {
  const result = await client.query("SELECT current_database() AS name");
  return result.rows[0]?.name || "";
};

const assertDemoResetEnvironment = async (client, env = process.env) => {
  if (env.DEMO_MODE !== "true") {
    throw new Error("Demo reset requires DEMO_MODE=true");
  }
  if (env.DEMO_RESET_ENABLED !== "true") {
    throw new Error("Demo reset requires DEMO_RESET_ENABLED=true");
  }

  const expectedDatabase = String(env.DEMO_DATABASE_NAME || "").trim();
  if (!expectedDatabase) {
    throw new Error("DEMO_DATABASE_NAME is required for demo reset");
  }

  const actualDatabase = await getCurrentDatabaseName(client);
  if (actualDatabase !== expectedDatabase) {
    throw new Error(
      `Demo reset refused: connected database "${actualDatabase}" does not match DEMO_DATABASE_NAME "${expectedDatabase}"`,
    );
  }

  const password = String(env.DEMO_ACCOUNT_PASSWORD || "");
  if (password.length < 8) {
    throw new Error(
      "DEMO_ACCOUNT_PASSWORD must contain at least 8 characters",
    );
  }

  return {
    databaseName: actualDatabase,
    password,
  };
};

const listResettableTables = async (client) => {
  const result = await client.query(
    `
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'app'
      AND tablename <> 'schema_migrations'
    ORDER BY tablename
    `,
  );
  return result.rows.map((row) => row.tablename);
};

const truncateApplicationTables = async (client, tables) => {
  if (!Array.isArray(tables) || tables.length === 0 || tables.includes("schema_migrations")) {
    throw new Error("Demo reset found no application tables to reset");
  }

  const qualifiedTables = tables
    .map((table) => `app.${quoteIdentifier(table)}`)
    .join(", ");

  await client.query(
    `TRUNCATE TABLE ${qualifiedTables} RESTART IDENTITY`,
  );
};

const snapshotDemoFileStorage = async () => {
  const targets = getApplicationStorageTargets();
  const snapshot = [];

  for (const target of targets) {
    snapshot.push({
      namespace: target.namespace,
      provider: target.provider,
      storage: target.storage,
      names: await target.storage.listNames(),
    });
  }

  return snapshot;
};

const clearDemoFileStorage = async (snapshot) => {
  const clearedNamespaces = [];

  for (const target of snapshot || []) {
    await target.storage.clearNames(target.names);
    clearedNamespaces.push(target.namespace);
  }

  return clearedNamespaces;
};

const resetDemoDatabase = async ({
  client,
  env = process.env,
  clearStorage = true,
  manageTransaction = true,
  shouldReset,
}) => {
  if (!manageTransaction && clearStorage) {
    throw new Error("Storage cleanup requires an owned transaction");
  }

  let storageSnapshot = [];
  let result;
  if (manageTransaction) await client.query("BEGIN");
  try {
    await lockDemoTransaction(client);
    // The decision must be made AFTER the lock, with no heartbeat/login able
    // to slip between this check and the reset transaction.
    const decision = shouldReset ? await shouldReset(client) : { reset: true };
    if (!decision.reset) {
      if (manageTransaction) await client.query("COMMIT");
      return decision;
    }

    const config = await assertDemoResetEnvironment(client, env);
    storageSnapshot = clearStorage ? await snapshotDemoFileStorage() : [];
    const tables = await listResettableTables(client);
    await truncateApplicationTables(client, tables);
    const seeded = await seedDemoDatabase(client, { password: config.password });
    result = {
      reset: true,
      databaseName: config.databaseName,
      tableCount: tables.length,
      storageNamespaces: [],
      seeded,
    };
    if (manageTransaction) await client.query("COMMIT");
  } catch (error) {
    if (manageTransaction) await client.query("ROLLBACK").catch(() => {});
    throw error;
  }

  // Delete only names captured before reset, never new visitors' uploads.
  // A storage failure after COMMIT must not report a failed database reset
  // or encourage callers to reset the newly seeded database again.
  if (clearStorage) {
    try {
      result.storageNamespaces = await clearDemoFileStorage(storageSnapshot);
    } catch (error) {
      result.storageCleanupFailed = true;
      logger.error("demo_storage_cleanup_failed", { error });
    }
  }
  return result;
};

module.exports = {
  DEMO_RESET_LOCK_KEY,
  assertDemoResetEnvironment,
  clearDemoFileStorage,
  getCurrentDatabaseName,
  snapshotDemoFileStorage,
  listResettableTables,
  quoteIdentifier,
  resetDemoDatabase,
  truncateApplicationTables,
};
