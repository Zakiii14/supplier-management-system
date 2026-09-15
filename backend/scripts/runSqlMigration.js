const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const allowedFlags = new Set(["--status", "--baseline"]);
const environmentArgs = args.filter((value) => value.startsWith("--env="));
const unknownArgs = args.filter(
  (value) => !allowedFlags.has(value) && !value.startsWith("--env="),
);

if (environmentArgs.length > 1) {
  throw new Error("Use only one --env=<file> argument.");
}
if (args.includes("--status") && args.includes("--baseline")) {
  throw new Error("Use only one migration mode: --status or --baseline.");
}
if (unknownArgs.length > 0) {
  throw new Error(
    `Unsupported migration argument: ${unknownArgs[0]}. Positional SQL files are no longer supported.`,
  );
}

const environmentArg = environmentArgs[0];
const mode = args.includes("--status")
  ? "status"
  : args.includes("--baseline")
    ? "baseline"
    : "apply";

const backendDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(backendDir, "..");
const migrationsDir = path.join(rootDir, "database", "migrations");
const baselinePath = path.join(rootDir, "database", "migration-baseline.json");
const envPath = environmentArg
  ? path.resolve(process.cwd(), environmentArg.slice("--env=".length))
  : path.join(backendDir, ".env");

require("dotenv").config({ path: envPath, override: true });

const pool = require("../src/config/database");
const { discoverMigrations, formatVersion } = require("../src/database/migrationFiles");
const {
  applyPendingMigrations,
  baselineLegacyMigrations,
  getMigrationStatus,
} = require("../src/database/migrationRunner");

const getBaselineVersion = () => {
  const config = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  if (!Number.isInteger(config.version) || config.version < 1) {
    throw new Error("Invalid migration baseline version.");
  }
  return config.version;
};

const run = async () => {
  const migrations = discoverMigrations(migrationsDir);
  const client = await pool.connect();

  try {
    if (mode === "status") {
      const status = await getMigrationStatus({ client, migrations });
      console.log(`Migration status: ${status.message}`);
      console.log(`Applied: ${status.appliedMigrations.length}`);
      console.log(`Pending: ${status.pendingMigrations.length}`);
      for (const migration of status.pendingMigrations) {
        console.log(`  PENDING ${migration.filename}`);
      }
      if (!status.historyValid) process.exitCode = 2;
      return;
    }

    if (mode === "baseline") {
      const baselineVersion = getBaselineVersion();
      const baselined = await baselineLegacyMigrations({
        client,
        migrations,
        baselineVersion,
      });
      console.log(
        `Migration baseline created through ${formatVersion(baselineVersion)} (${baselined.length} records).`,
      );
      return;
    }

    const applied = await applyPendingMigrations({ client, migrations });
    if (applied.length === 0) {
      console.log("Database migrations are already up to date.");
      return;
    }

    for (const migration of applied) {
      console.log(`Applied ${migration.filename} (${migration.executionMs} ms)`);
    }
    console.log(`Applied ${applied.length} migration(s) successfully.`);
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
});
