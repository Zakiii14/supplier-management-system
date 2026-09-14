const fs = require("node:fs");
const path = require("node:path");

const argumentsList = process.argv.slice(2);
const migrationArgument = argumentsList.find((argument) => !argument.startsWith("--"));
const environmentArgument = argumentsList.find((argument) => argument.startsWith("--env="));

if (!migrationArgument) {
  console.error("Usage: npm run migrate -- <migration.sql> [--env=.env.test]");
  process.exit(1);
}

const migrationPath = path.resolve(process.cwd(), migrationArgument);
if (path.extname(migrationPath).toLowerCase() !== ".sql" || !fs.existsSync(migrationPath)) {
  console.error(`Migration file was not found: ${migrationPath}`);
  process.exit(1);
}

const environmentPath = environmentArgument
  ? path.resolve(process.cwd(), environmentArgument.slice("--env=".length))
  : path.resolve(__dirname, "../.env");

require("dotenv").config({ path: environmentPath, override: true });
const pool = require("../src/config/database");

const run = async () => {
  try {
    const sql = fs.readFileSync(migrationPath, "utf8");
    await pool.query(sql);
    console.log(`Migration completed on ${process.env.DB_NAME}: ${path.basename(migrationPath)}`);
  } catch (error) {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
