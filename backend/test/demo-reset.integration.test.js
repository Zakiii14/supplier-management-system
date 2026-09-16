const path = require("node:path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env.test"),
  override: true,
});

if (process.env.DB_NAME !== "supplier_management_test") {
  throw new Error("Integration tests must use supplier_management_test");
}

const {
  test,
  after,
} = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../src/config/database");
const {
  resetDemoDatabase,
} = require("../src/demo/demoResetService");

after(async () => {
  await pool.end();
});

test("demo reset reseeds deterministic accounts and data without touching migration history", async () => {
  const client = await pool.connect();

  try {
    const migrationCountBefore = await client.query(
      "SELECT COUNT(*)::int AS count FROM app.schema_migrations",
    );

    await client.query("BEGIN");
    const result = await resetDemoDatabase({
      client,
      clearStorage: false,
      manageTransaction: false,
      env: {
        ...process.env,
        DEMO_MODE: "true",
        DEMO_RESET_ENABLED: "true",
        DEMO_DATABASE_NAME: "supplier_management_test",
        DEMO_ACCOUNT_PASSWORD: "DemoPass123!",
      },
    });

    assert.equal(result.databaseName, "supplier_management_test");
    assert.equal(result.seeded.accounts, 6);
    assert.equal(result.seeded.products, 5);
    assert.equal(result.seeded.purchaseOrders, 2);
    assert.equal(result.seeded.salesOrders, 2);

    const demoUsers = await client.query(
      `
      SELECT username, role
      FROM app.users
      WHERE username LIKE 'demo_%'
      ORDER BY username
      `,
    );
    assert.deepEqual(
      demoUsers.rows.map((row) => row.username),
      [
        "demo_admin",
        "demo_finance",
        "demo_manager",
        "demo_purchasing",
        "demo_sales",
        "demo_warehouse",
      ],
    );

    const businessCounts = await client.query(
      `
      SELECT
        (SELECT COUNT(*)::int FROM app.suppliers) AS suppliers,
        (SELECT COUNT(*)::int FROM app.products) AS products,
        (SELECT COUNT(*)::int FROM app.customers) AS customers,
        (SELECT COUNT(*)::int FROM app.purchase_orders) AS purchase_orders,
        (SELECT COUNT(*)::int FROM app.sales_orders) AS sales_orders,
        (SELECT COUNT(*)::int FROM app.invoices) AS invoices,
        (SELECT COUNT(*)::int FROM app.payments) AS payments
      `,
    );
    assert.deepEqual(businessCounts.rows[0], {
      suppliers: 3,
      products: 5,
      customers: 3,
      purchase_orders: 2,
      sales_orders: 2,
      invoices: 1,
      payments: 1,
    });

    const migrationCountAfter = await client.query(
      "SELECT COUNT(*)::int AS count FROM app.schema_migrations",
    );
    assert.equal(
      migrationCountAfter.rows[0].count,
      migrationCountBefore.rows[0].count,
    );
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
});

test("demo reset refuses a database name mismatch", async () => {
  const client = await pool.connect();
  try {
    await assert.rejects(
      () =>
        resetDemoDatabase({
          client,
          clearStorage: false,
          manageTransaction: false,
          env: {
            ...process.env,
            DEMO_MODE: "true",
            DEMO_RESET_ENABLED: "true",
            DEMO_DATABASE_NAME: "definitely_not_the_test_database",
            DEMO_ACCOUNT_PASSWORD: "DemoPass123!",
          },
        }),
      /does not match DEMO_DATABASE_NAME/,
    );
  } finally {
    client.release();
  }
});
