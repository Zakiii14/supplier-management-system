const assert = require("node:assert/strict");
const fsPromises = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createDatabaseDump,
  databaseUrlHasSslOptions,
  getConnectionArguments,
  getConnectionConfiguration,
  restoreDatabaseDump,
} = require("../src/backup/postgresBackup");

test("PostgreSQL backup CLI arguments never expose DATABASE_URL credentials", () => {
  const databaseUrl = "postgresql://user:pass@db.example.com:5432/supplyflow?sslmode=require";
  assert.deepEqual(getConnectionArguments({ DATABASE_URL: databaseUrl }), [
    "--host",
    "db.example.com",
    "--port",
    "5432",
    "--username",
    "user",
    "--dbname",
    "supplyflow",
  ]);

  assert.deepEqual(
    getConnectionConfiguration({ DATABASE_URL: databaseUrl }),
    {
      host: "db.example.com",
      port: "5432",
      database: "supplyflow",
      user: "user",
      password: "pass",
      sslMode: "require",
      sslCert: null,
      sslKey: null,
      sslRootCert: null,
      inlineCa: "",
    },
  );

  assert.equal(databaseUrlHasSslOptions(databaseUrl), true);
  assert.equal(databaseUrlHasSslOptions("postgresql://u:p@db/x"), false);
});

test("PostgreSQL backup CLI arguments support discrete settings", () => {
  assert.deepEqual(
    getConnectionArguments({
      DB_HOST: "localhost",
      DB_PORT: "5433",
      DB_USER: "postgres",
      DB_NAME: "supplier_management",
    }),
    [
      "--host",
      "localhost",
      "--port",
      "5433",
      "--username",
      "postgres",
      "--dbname",
      "supplier_management",
    ],
  );
});

test("pg_dump and pg_restore use a temporary passfile and atomic restore", async () => {
  const root = await fsPromises.mkdtemp(path.join(os.tmpdir(), "supplyflow-pg-tools-"));
  const dumpPath = path.join(root, "database.dump");
  const calls = [];
  const environment = {
    NODE_ENV: "development",
    DB_HOST: "localhost",
    DB_PORT: "5432",
    DB_NAME: "supplier_management",
    DB_USER: "postgres",
    DB_PASSWORD: "secret:with\\chars",
    DB_SSL_MODE: "disable",
    PG_DUMP_BIN: "custom-pg-dump",
    PG_RESTORE_BIN: "custom-pg-restore",
  };

  try {
    await createDatabaseDump(dumpPath, {
      environment,
      runner: async (command, args, childEnvironment) => {
        calls.push({ command, args, childEnvironment: { ...childEnvironment } });
        assert.equal(args.includes("secret:with\\chars"), false);
        assert.equal(childEnvironment.PGPASSWORD, undefined);
        assert.ok(childEnvironment.PGPASSFILE);
        const passFile = await fsPromises.readFile(childEnvironment.PGPASSFILE, "utf8");
        assert.match(passFile, /secret\\:with\\\\chars/);
        const fileIndex = args.indexOf("--file");
        await fsPromises.writeFile(args[fileIndex + 1], "PGDMP-test");
      },
    });

    await restoreDatabaseDump(dumpPath, {
      environment,
      runner: async (command, args, childEnvironment) => {
        calls.push({ command, args, childEnvironment: { ...childEnvironment } });
        assert.equal(args.includes("secret:with\\chars"), false);
        assert.equal(childEnvironment.PGPASSWORD, undefined);
        assert.ok(childEnvironment.PGPASSFILE);
      },
    });

    assert.equal(calls[0].command, "custom-pg-dump");
    assert.ok(calls[0].args.includes("--format=custom"));
    assert.equal(calls[0].childEnvironment.PGSSLMODE, "disable");

    assert.equal(calls[1].command, "custom-pg-restore");
    assert.ok(calls[1].args.includes("--clean"));
    assert.ok(calls[1].args.includes("--if-exists"));
    assert.ok(calls[1].args.includes("--single-transaction"));
    assert.ok(calls[1].args.includes("--exit-on-error"));
    assert.equal(calls[1].args.at(-1), path.resolve(dumpPath));
  } finally {
    await fsPromises.rm(root, { recursive: true, force: true });
  }
});
