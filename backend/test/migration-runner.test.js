const assert = require("node:assert/strict");
const test = require("node:test");

const { calculateChecksum } = require("../src/database/migrationFiles");
const {
  applyPendingMigrations,
  baselineLegacyMigrations,
} = require("../src/database/migrationRunner");

const makeMigration = (version, filename, sql = `SELECT ${version};`) => ({
  version,
  filename,
  sql,
  checksum: calculateChecksum(sql),
});

const createClient = ({ tracking = true, applied = [] } = {}) => {
  const queries = [];
  const rows = [...applied];
  let hasTracking = tracking;

  return {
    queries,
    async query(sql, params = []) {
      const text = String(sql).trim();
      queries.push({ text, params });

      if (text.includes("to_regclass('app.users')")) {
        return {
          rows: [{
            has_core_schema: true,
            has_tracking_table: hasTracking,
          }],
        };
      }
      if (text.startsWith("CREATE TABLE IF NOT EXISTS app.schema_migrations")) {
        hasTracking = true;
        return { rows: [] };
      }
      if (text.startsWith("SELECT version, filename, checksum")) {
        return { rows: [...rows] };
      }
      if (text.includes("INSERT INTO app.schema_migrations")) {
        rows.push({
          version: params[0],
          filename: params[1],
          checksum: params[2],
          execution_ms: params[3],
          is_baseline: params[4],
        });
      }
      return { rows: [] };
    },
  };
};

test("baseline stops at the configured legacy version", async () => {
  const client = createClient({ tracking: false });
  const migrations = [
    makeMigration(1, "001_first.sql"),
    makeMigration(2, "002_second.sql"),
    makeMigration(3, "003_future.sql"),
  ];

  const result = await baselineLegacyMigrations({
    client,
    migrations,
    baselineVersion: 2,
  });

  assert.deepEqual(result.map((item) => item.version), [1, 2]);
  const inserts = client.queries.filter((item) =>
    item.text.includes("INSERT INTO app.schema_migrations"),
  );
  assert.equal(inserts.length, 2);
});

test("pending migration executes before its tracking record commits", async () => {
  const first = makeMigration(1, "001_first.sql");
  const second = makeMigration(2, "002_second.sql", "SELECT 200;");
  const client = createClient({
    applied: [{
      version: 1,
      filename: first.filename,
      checksum: first.checksum,
      execution_ms: 0,
      is_baseline: true,
    }],
  });

  const result = await applyPendingMigrations({
    client,
    migrations: [first, second],
  });

  assert.equal(result.length, 1);
  const texts = client.queries.map((item) => item.text);
  assert.equal(texts.indexOf("BEGIN") < texts.indexOf("SELECT 200;"), true);
  assert.equal(texts.indexOf("SELECT 200;") < texts.indexOf("COMMIT"), true);
});

test("apply refuses a database before migration tracking is initialized", async () => {
  const client = createClient({ tracking: false });

  await assert.rejects(
    () => applyPendingMigrations({
      client,
      migrations: [makeMigration(1, "001_first.sql")],
    }),
    /Migration tracking is not initialized/,
  );
});
