const fs = require("node:fs/promises");
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.test"), override: true });
const pool = require("../src/config/database");

// schema.sql is schema-only. Restore the original configuration INSERTs that
// predate migration tracking without replaying legacy DDL or creating demo data.
const main = async () => {
  const client = await pool.connect();
  try {
    const actual = (await client.query("SELECT current_database() AS name")).rows[0].name;
    if (process.env.NODE_ENV !== "test" || actual !== "supplier_management_test") {
      throw new Error("Test defaults may only be seeded into supplier_management_test under NODE_ENV=test");
    }
    await client.query("BEGIN");
    const directory = path.resolve(__dirname, "../../database/migrations");
    const files = (await fs.readdir(directory)).filter((name) => /^\d{3}_.*\.sql$/.test(name)).sort();
    let count = 0;
    for (const name of files) {
      if (Number(name.slice(0, 3)) > 20) continue;
      const sql = await fs.readFile(path.join(directory, name), "utf8");
      const inserts = sql.matchAll(/INSERT INTO app\.(?:code_number_settings|payment_settings|tax_settings)\b[\s\S]*?;/g);
      for (const [statement] of inserts) {
        await client.query(statement);
        count += 1;
      }
    }
    await client.query("COMMIT");
    console.log(`Seeded ${count} default-configuration statements into the test database.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
