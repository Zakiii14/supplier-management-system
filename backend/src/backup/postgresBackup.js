const fsPromises = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const SSL_QUERY_KEYS = ["sslmode", "sslcert", "sslkey", "sslrootcert"];
const POSTGRES_ENV_KEYS = [
  "PGHOST",
  "PGPORT",
  "PGDATABASE",
  "PGUSER",
  "PGPASSWORD",
  "PGPASSFILE",
  "PGSSLMODE",
  "PGSSLCERT",
  "PGSSLKEY",
  "PGSSLROOTCERT",
];

const databaseUrlHasSslOptions = (value) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return SSL_QUERY_KEYS.some((key) => url.searchParams.has(key));
  } catch {
    return false;
  }
};

const decodeUrlPart = (value) => decodeURIComponent(value || "");

const getConnectionConfiguration = (environment = process.env) => {
  const databaseUrl = String(environment.DATABASE_URL || "").trim();

  if (databaseUrl) {
    let url;
    try {
      url = new URL(databaseUrl);
    } catch {
      throw new Error("DATABASE_URL must be a valid PostgreSQL URL for backup operations");
    }

    if (!["postgres:", "postgresql:"].includes(url.protocol)) {
      throw new Error("DATABASE_URL must use postgres:// or postgresql:// for backup operations");
    }

    const database = decodeUrlPart(url.pathname.replace(/^\//, ""));
    if (!url.hostname || !database || !url.username) {
      throw new Error("DATABASE_URL must include host, database, and user for backup operations");
    }

    return {
      host: url.hostname,
      port: url.port || "5432",
      database,
      user: decodeUrlPart(url.username),
      password: decodeUrlPart(url.password),
      sslMode: url.searchParams.get("sslmode") || null,
      sslCert: url.searchParams.get("sslcert") || null,
      sslKey: url.searchParams.get("sslkey") || null,
      sslRootCert: url.searchParams.get("sslrootcert") || null,
      inlineCa: "",
    };
  }

  return {
    host: String(environment.DB_HOST || "").trim(),
    port: String(environment.DB_PORT || 5432),
    database: String(environment.DB_NAME || "").trim(),
    user: String(environment.DB_USER || "").trim(),
    password: String(environment.DB_PASSWORD || ""),
    sslMode: String(
      environment.DB_SSL_MODE ||
        (environment.NODE_ENV === "production" ? "require" : "disable"),
    ).trim(),
    sslCert: null,
    sslKey: null,
    sslRootCert: null,
    inlineCa: String(environment.DB_SSL_CA || "").trim(),
  };
};

const getConnectionArguments = (environment = process.env) => {
  const connection = getConnectionConfiguration(environment);
  return [
    "--host",
    connection.host,
    "--port",
    connection.port,
    "--username",
    connection.user,
    "--dbname",
    connection.database,
  ];
};

const escapePgPassValue = (value) => String(value).replace(/\\/g, "\\\\").replace(/:/g, "\\:");

const runCommand = (command, args, environment) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: environment,
      stdio: ["ignore", "inherit", "inherit"],
      windowsHide: true,
      shell: false,
    });

    child.once("error", (error) => {
      reject(new Error(`Failed to start ${command}: ${error.message}`));
    });
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`,
        ),
      );
    });
  });

const withPostgresCliContext = async (callback, environment = process.env) => {
  const connection = getConnectionConfiguration(environment);
  const childEnvironment = { ...environment };
  let temporaryDirectory = null;

  for (const key of POSTGRES_ENV_KEYS) delete childEnvironment[key];
  delete childEnvironment.DATABASE_URL;
  delete childEnvironment.DB_PASSWORD;

  const needsTemporaryDirectory = Boolean(connection.password || connection.inlineCa);
  if (needsTemporaryDirectory) {
    temporaryDirectory = await fsPromises.mkdtemp(
      path.join(os.tmpdir(), "supplyflow-pg-cli-"),
    );
  }

  if (connection.password) {
    const passFile = path.join(temporaryDirectory, "pgpass.conf");
    const passLine = [
      connection.host,
      connection.port,
      connection.database,
      connection.user,
      connection.password,
    ]
      .map(escapePgPassValue)
      .join(":");
    await fsPromises.writeFile(passFile, `${passLine}\n`, { mode: 0o600 });
    childEnvironment.PGPASSFILE = passFile;
  }

  if (connection.sslMode) childEnvironment.PGSSLMODE = connection.sslMode;
  if (connection.sslCert) childEnvironment.PGSSLCERT = connection.sslCert;
  if (connection.sslKey) childEnvironment.PGSSLKEY = connection.sslKey;
  if (connection.sslRootCert) childEnvironment.PGSSLROOTCERT = connection.sslRootCert;

  if (connection.inlineCa) {
    const caPath = path.join(temporaryDirectory, "ca.pem");
    await fsPromises.writeFile(caPath, connection.inlineCa.replace(/\\n/g, "\n"), {
      mode: 0o600,
    });
    childEnvironment.PGSSLROOTCERT = caPath;
  }

  try {
    return await callback({
      connectionArguments: getConnectionArguments(environment),
      environment: childEnvironment,
    });
  } finally {
    if (temporaryDirectory) {
      await fsPromises.rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
};

const createDatabaseDump = async (
  destination,
  { environment = process.env, runner = runCommand } = {},
) =>
  withPostgresCliContext(async (context) => {
    const command = String(environment.PG_DUMP_BIN || "pg_dump").trim() || "pg_dump";
    await runner(
      command,
      [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--file",
        path.resolve(destination),
        ...context.connectionArguments,
      ],
      context.environment,
    );
  }, environment);

const restoreDatabaseDump = async (
  source,
  { environment = process.env, runner = runCommand } = {},
) =>
  withPostgresCliContext(async (context) => {
    const command = String(environment.PG_RESTORE_BIN || "pg_restore").trim() || "pg_restore";
    await runner(
      command,
      [
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--single-transaction",
        "--exit-on-error",
        ...context.connectionArguments,
        path.resolve(source),
      ],
      context.environment,
    );
  }, environment);

module.exports = {
  createDatabaseDump,
  databaseUrlHasSslOptions,
  getConnectionArguments,
  getConnectionConfiguration,
  restoreDatabaseDump,
};
