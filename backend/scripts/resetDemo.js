const path = require("node:path");
const dotenv = require("dotenv");

const rawArguments = process.argv.slice(2);
const envArgument = rawArguments.find((value) =>
  value.startsWith("--env="),
);
const envPath = envArgument?.slice("--env=".length);
if (envArgument && !envPath) {
  throw new Error("--env requires a file path");
}

dotenv.config(
  envPath
    ? { path: path.resolve(envPath), override: true }
    : undefined,
);

const databaseOnly = rawArguments.includes("--database-only");
const supported = new Set([
  "--database-only",
  ...(envArgument ? [envArgument] : []),
]);
for (const argument of rawArguments) {
  if (!supported.has(argument)) {
    throw new Error(`Unknown demo reset option: ${argument}`);
  }
}

const pool = require("../src/config/database");
const {
  resetDemoDatabase,
} = require("../src/demo/demoResetService");

const main = async () => {
  const client = await pool.connect();
  try {
    const result = await resetDemoDatabase({
      client,
      clearStorage: !databaseOnly,
    });

    console.log(`Demo reset completed for database: ${result.databaseName}`);
    console.log(`Reset tables: ${result.tableCount}`);
    console.log(`Seeded demo accounts: ${result.seeded.accounts}`);
    console.log(
      `Seeded master data: ${result.seeded.suppliers} suppliers, ${result.seeded.products} products, ${result.seeded.customers} customers`,
    );
    console.log(
      `Seeded transactions: ${result.seeded.purchaseOrders} purchase orders, ${result.seeded.salesOrders} sales orders, ${result.seeded.invoices} invoices, ${result.seeded.payments} payments`,
    );
    if (databaseOnly) {
      console.log("File storage reset skipped (--database-only).");
    } else {
      console.log(
        `Reset storage namespaces: ${result.storageNamespaces.join(", ") || "none"}`,
      );
    }
  } finally {
    client.release();
    await pool.end();
  }
};

main().catch((error) => {
  console.error(`Demo reset failed: ${error.message}`);
  process.exitCode = 1;
});
