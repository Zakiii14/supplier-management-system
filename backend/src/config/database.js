const { Pool } = require("pg");
require("dotenv").config();

const SUPPORTED_SSL_MODES = new Set([
  "disable",
  "require",
  "verify-full",
]);
const SSL_QUERY_KEYS = ["sslmode", "sslcert", "sslkey", "sslrootcert"];

const connectionStringHasSslOptions = (connectionString) => {
  if (!connectionString) return false;
  try {
    const url = new URL(connectionString);
    return SSL_QUERY_KEYS.some((key) => url.searchParams.has(key));
  } catch {
    return false;
  }
};

const getSslConfig = (connectionString) => {
  const configuredMode = (process.env.DB_SSL_MODE || "")
    .trim()
    .toLowerCase();
  const hasConnectionStringSsl =
    connectionStringHasSslOptions(connectionString);

  if (configuredMode && !SUPPORTED_SSL_MODES.has(configuredMode)) {
    throw new Error(
      `Unsupported DB_SSL_MODE: ${configuredMode}. Use disable, require, or verify-full.`,
    );
  }

  if (configuredMode && hasConnectionStringSsl) {
    throw new Error(
      "Configure PostgreSQL SSL either with DB_SSL_MODE or SSL parameters in DATABASE_URL, not both.",
    );
  }

  if (!configuredMode && hasConnectionStringSsl) return undefined;

  const sslMode =
    configuredMode ||
    (process.env.NODE_ENV === "production" ? "require" : "disable");

  if (sslMode === "disable") return false;

  const ssl = {
    rejectUnauthorized: sslMode === "verify-full",
  };
  const ca = (process.env.DB_SSL_CA || "").trim();
  if (ca) ssl.ca = ca.replace(/\\n/g, "\n");
  return ssl;
};

const readPositiveInteger = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const isVercelRuntime =
  process.env.VERCEL === "1" ||
  String(process.env.DEPLOYMENT_TARGET || "").trim().toLowerCase() ===
    "vercel";

const connectionString = (process.env.DATABASE_URL || "").trim();
const poolConfig = connectionString
  ? { connectionString }
  : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };

poolConfig.max = readPositiveInteger(
  "DB_POOL_MAX",
  isVercelRuntime ? 3 : 10,
);
poolConfig.idleTimeoutMillis = readPositiveInteger(
  "DB_IDLE_TIMEOUT_MS",
  10000,
);
poolConfig.connectionTimeoutMillis = readPositiveInteger(
  "DB_CONNECTION_TIMEOUT_MS",
  5000,
);

const ssl = getSslConfig(connectionString);
if (ssl !== undefined) poolConfig.ssl = ssl;

const pool = new Pool(poolConfig);

module.exports = pool;
