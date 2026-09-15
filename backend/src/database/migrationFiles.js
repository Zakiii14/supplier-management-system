const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MIGRATION_FILE_PATTERN = /^(\d{3,})_([a-z0-9][a-z0-9_-]*)\.sql$/;

const formatVersion = (version) => String(version).padStart(3, "0");

const calculateChecksum = (sql) =>
  crypto.createHash("sha256").update(sql, "utf8").digest("hex");

const parseMigrationFilename = (filename) => {
  const match = filename.match(MIGRATION_FILE_PATTERN);
  if (!match) {
    throw new Error(
      `Invalid migration filename: ${filename}. Expected <number>_<name>.sql.`,
    );
  }

  return {
    version: Number(match[1]),
    name: match[2],
  };
};

const discoverMigrations = (migrationsDirectory) => {
  if (!fs.existsSync(migrationsDirectory)) {
    throw new Error(`Migration directory was not found: ${migrationsDirectory}`);
  }

  const migrations = fs
    .readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => {
      const parsed = parseMigrationFilename(entry.name);
      const filePath = path.join(migrationsDirectory, entry.name);
      const sql = fs.readFileSync(filePath, "utf8");

      return {
        version: parsed.version,
        name: parsed.name,
        filename: entry.name,
        filePath,
        sql,
        checksum: calculateChecksum(sql),
      };
    })
    .sort((left, right) => left.version - right.version);

  const seenVersions = new Set();
  for (let index = 0; index < migrations.length; index += 1) {
    const migration = migrations[index];
    if (seenVersions.has(migration.version)) {
      throw new Error(
        `Duplicate migration version detected: ${formatVersion(migration.version)}`,
      );
    }
    seenVersions.add(migration.version);

    const expectedVersion = index + 1;
    if (migration.version !== expectedVersion) {
      throw new Error(
        `Migration sequence is not contiguous. Expected ${formatVersion(expectedVersion)} but found ${formatVersion(migration.version)} (${migration.filename}).`,
      );
    }
  }

  return migrations;
};

const validateMigrationHistory = (migrations, appliedMigrations) => {
  const localByVersion = new Map(
    migrations.map((migration) => [migration.version, migration]),
  );
  const appliedVersions = new Set();

  for (const applied of appliedMigrations) {
    const local = localByVersion.get(applied.version);
    if (!local) {
      throw new Error(
        `Applied migration ${formatVersion(applied.version)} (${applied.filename}) is missing from the repository.`,
      );
    }
    if (local.filename !== applied.filename) {
      throw new Error(
        `Migration ${formatVersion(applied.version)} filename changed after it was applied.`,
      );
    }
    if (local.checksum !== applied.checksum) {
      throw new Error(
        `Migration ${local.filename} changed after it was applied. Create a new migration instead.`,
      );
    }
    appliedVersions.add(applied.version);
  }

  const highestAppliedVersion = appliedMigrations.reduce(
    (highest, migration) => Math.max(highest, migration.version),
    0,
  );

  for (const migration of migrations) {
    if (
      migration.version <= highestAppliedVersion &&
      !appliedVersions.has(migration.version)
    ) {
      throw new Error(
        `Migration history has a gap at ${migration.filename}.`,
      );
    }
  }

  return migrations.filter(
    (migration) => !appliedVersions.has(migration.version),
  );
};

module.exports = {
  MIGRATION_FILE_PATTERN,
  calculateChecksum,
  discoverMigrations,
  formatVersion,
  parseMigrationFilename,
  validateMigrationHistory,
};
