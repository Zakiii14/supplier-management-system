const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  calculateChecksum,
  discoverMigrations,
  validateMigrationHistory,
} = require("../src/database/migrationFiles");

const createDirectory = (files) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sf-migrations-"));
  for (const [filename, sql] of Object.entries(files)) {
    fs.writeFileSync(path.join(directory, filename), sql, "utf8");
  }
  return directory;
};

const migration = (version, filename, sql) => ({
  version,
  filename,
  sql,
  checksum: calculateChecksum(sql),
});

test("migration discovery sorts files and calculates checksums", () => {
  const directory = createDirectory({
    "002_second.sql": "SELECT 2;",
    "001_first.sql": "SELECT 1;",
  });
  const migrations = discoverMigrations(directory);

  assert.deepEqual(
    migrations.map((item) => item.filename),
    ["001_first.sql", "002_second.sql"],
  );
  assert.equal(migrations[0].checksum, calculateChecksum("SELECT 1;"));
});

test("migration discovery rejects sequence gaps and duplicate versions", () => {
  const gapDirectory = createDirectory({
    "001_first.sql": "SELECT 1;",
    "003_third.sql": "SELECT 3;",
  });
  assert.throws(
    () => discoverMigrations(gapDirectory),
    /Migration sequence is not contiguous/,
  );

  const duplicateDirectory = createDirectory({
    "001_first.sql": "SELECT 1;",
    "001_other.sql": "SELECT 2;",
  });
  assert.throws(
    () => discoverMigrations(duplicateDirectory),
    /Duplicate migration version/,
  );
});

test("migration history rejects checksum drift", () => {
  const local = [migration(1, "001_first.sql", "SELECT 1;")];
  const applied = [
    {
      version: 1,
      filename: "001_first.sql",
      checksum: calculateChecksum("SELECT 99;"),
    },
  ];

  assert.throws(
    () => validateMigrationHistory(local, applied),
    /changed after it was applied/,
  );
});
