const path = require("node:path");
const dotenv = require("dotenv");

const {
  createBackupBundle,
  pruneBackupBundles,
  restoreBackupBundle,
  verifyBackupBundle,
} = require("../src/backup/backupService");
const {
  createDatabaseDump,
  restoreDatabaseDump,
} = require("../src/backup/postgresBackup");
const {
  getApplicationStorageTargets,
} = require("../src/services/fileStorageService");

const DEFAULT_RETENTION_DAYS = 14;
const DEFAULT_BACKUP_ROOT = path.resolve(__dirname, "../backups");
const ACTIONS = new Set(["create", "verify", "restore"]);

const rawArguments = process.argv.slice(2);
const envArguments = rawArguments.filter((value) => value.startsWith("--env="));
if (envArguments.length > 1) {
  throw new Error("Only one --env=<file> argument is allowed");
}

const envPath = envArguments[0]?.slice("--env=".length);
if (envPath !== undefined && !envPath.trim()) {
  throw new Error("--env requires a file path");
}

dotenv.config(envPath ? { path: path.resolve(envPath) } : undefined);

const argumentsWithoutEnv = rawArguments.filter((value) => !value.startsWith("--env="));
const action = argumentsWithoutEnv.shift();
if (!ACTIONS.has(action)) {
  throw new Error("Usage: backup.js <create|verify|restore> [backup-directory] [options]");
}

const flags = new Set(argumentsWithoutEnv.filter((value) => value.startsWith("--")));
const positional = argumentsWithoutEnv.filter((value) => !value.startsWith("--"));
const supportedFlags = new Set(["--maintenance", "--confirm-restore"]);
for (const flag of flags) {
  if (!supportedFlags.has(flag)) throw new Error(`Unknown backup option: ${flag}`);
}

const pathContains = (parent, candidate) => {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const pathsOverlap = (left, right) =>
  pathContains(left, right) || pathContains(right, left);

const getBackupRoot = () => {
  const configured = String(process.env.BACKUP_ROOT || "").trim();
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new Error("BACKUP_ROOT is required for production backup operations");
  }
  if (
    process.env.NODE_ENV === "production" &&
    configured &&
    !path.isAbsolute(configured)
  ) {
    throw new Error("BACKUP_ROOT must be an absolute path in production");
  }
  return configured ? path.resolve(configured) : DEFAULT_BACKUP_ROOT;
};

const assertSafeBackupLayout = (backupRoot, storageTargets) => {
  for (const target of storageTargets) {
    if (pathsOverlap(backupRoot, target.directory)) {
      throw new Error(
        `Backup storage must be separate from live file storage: ${target.namespace}`,
      );
    }
  }
};

const getRetentionDays = () => {
  const value = Number(process.env.BACKUP_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("BACKUP_RETENTION_DAYS must be a positive integer");
  }
  return value;
};

const requireMaintenanceConfirmation = () => {
  if (process.env.NODE_ENV === "production" && !flags.has("--maintenance")) {
    throw new Error(
      "Production backup and restore require --maintenance after application writes have been stopped",
    );
  }
};

const main = async () => {
  const storageTargets = getApplicationStorageTargets();

  if (action === "create") {
    if (positional.length > 0 || flags.has("--confirm-restore")) {
      throw new Error("backup:create does not accept a backup directory or --confirm-restore");
    }
    requireMaintenanceConfirmation();

    const backupRoot = getBackupRoot();
    assertSafeBackupLayout(backupRoot, storageTargets);
    const result = await createBackupBundle({
      backupRoot,
      storageTargets,
      dumpDatabase: createDatabaseDump,
      consistencyMode: flags.has("--maintenance") ? "maintenance" : "live",
    });
    const removed = await pruneBackupBundles({
      backupRoot,
      retentionDays: getRetentionDays(),
    });

    console.log(`Backup created: ${result.backupDirectory}`);
    console.log(`Retention cleanup removed: ${removed.length}`);
    return;
  }

  if (positional.length !== 1) {
    throw new Error(`${action} requires exactly one backup directory path`);
  }
  const backupDirectory = path.resolve(positional[0]);

  if (action === "verify") {
    if (flags.size > 0) throw new Error("backup:verify does not accept flags");
    const result = await verifyBackupBundle(backupDirectory);
    console.log("Backup verification passed.");
    console.log(`Created: ${result.manifest.created_at}`);
    console.log(`Storage files: ${result.storageFileCount}`);
    return;
  }

  requireMaintenanceConfirmation();
  if (!flags.has("--confirm-restore")) {
    throw new Error("Restore requires --confirm-restore");
  }

  assertSafeBackupLayout(backupDirectory, storageTargets);
  const manifest = await restoreBackupBundle({
    backupDirectory,
    storageTargets,
    restoreDatabase: restoreDatabaseDump,
    confirmRestore: true,
  });
  console.log(`Restore completed from backup created at ${manifest.created_at}.`);
  console.log("Run npm run migrate:status before starting application traffic.");
};

main().catch((error) => {
  console.error(`Backup operation failed: ${error.message}`);
  process.exitCode = 1;
});
