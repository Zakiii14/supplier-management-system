const fs = require("node:fs/promises");
const path = require("node:path");

const {
  getApplicationStorageTargets,
} = require("../services/fileStorageService");
const {
  seedDemoDatabase,
} = require("./demoSeed");

const DEMO_RESET_LOCK_KEY = 420260916;

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
    throw new Error("DEMO_ACCOUNT_PASSWORD must contain at least 8 characters");
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
  if (!Array.isArray(tables) || tables.length === 0) {
    throw new Error("Demo reset found no application tables to reset");
  }

  const qualifiedTables = tables
    .map((table) => `app.${quoteIdentifier(table)}`)
    .join(", ");

  await client.query(
    `TRUNCATE TABLE ${qualifiedTables} RESTART IDENTITY CASCADE`,
  );
};

const snapshotDemoFileStorage = async () => {
  const targets = getApplicationStorageTargets();
  const snapshot = [];

  for (const target of targets) {
    let names = [];
    try {
      names = await fs.readdir(target.directory);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    snapshot.push({
      ...target,
      names: names.filter(
        (name) =>
          name &&
          name === path.basename(name),
      ),
    });
  }

  return snapshot;
};

const clearDemoFileStorage = async (snapshot) => {
  const clearedNamespaces = [];

  for (const target of snapshot || []) {
    for (const name of target.names) {
      await fs.rm(
        path.join(target.directory, name),
        {
          recursive: true,
          force: true,
        },
      );
    }
    await fs.mkdir(target.directory, { recursive: true });
    clearedNamespaces.push(target.namespace);
  }

  return clearedNamespaces;
};

const resetDemoDatabase = async ({
  client,
  env = process.env,
  clearStorage = true,
  manageTransaction = true,
}) => {
  const config = await assertDemoResetEnvironment(client, env);
  const storageSnapshot = clearStorage
    ? await snapshotDemoFileStorage()
    : [];

  const lock = await client.query(
    "SELECT pg_try_advisory_lock($1) AS acquired",
    [DEMO_RESET_LOCK_KEY],
  );
  if (!lock.rows[0]?.acquired) {
    throw new Error("Another demo reset is already running");
  }

  try {
    const tables = await listResettableTables(client);

    if (manageTransaction) {
      await client.query("BEGIN");
    }

    try {
      await truncateApplicationTables(client, tables);
      const seeded = await seedDemoDatabase(client, {
        password: config.password,
      });

      if (manageTransaction) {
        await client.query("COMMIT");
      }

      const storageNamespaces = clearStorage
        ? await clearDemoFileStorage(storageSnapshot)
        : [];

      return {
        databaseName: config.databaseName,
        tableCount: tables.length,
        storageNamespaces,
        seeded,
      };
    } catch (error) {
      if (manageTransaction) {
        await client.query("ROLLBACK").catch(() => {});
      }
      throw error;
    }
  } finally {
    await client.query(
      "SELECT pg_advisory_unlock($1)",
      [DEMO_RESET_LOCK_KEY],
    ).catch(() => {});
  }
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
