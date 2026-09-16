const assert = require("node:assert/strict");
const path = require("node:path");
const { after, test } = require("node:test");

const validateEnvironment = require("../src/config/validateEnvironment");

const TRACKED_ENVIRONMENT_KEYS = [
  "NODE_ENV",
  "VERCEL",
  "DEPLOYMENT_TARGET",
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "DB_SSL_MODE",
  "DB_SSL_CA",
  "DB_POOL_MAX",
  "DB_IDLE_TIMEOUT_MS",
  "DB_CONNECTION_TIMEOUT_MS",
  "LOG_LEVEL",
  "READINESS_TIMEOUT_MS",
  "SHUTDOWN_TIMEOUT_MS",
  "JWT_SECRET",
  "FRONTEND_URL",
  "EMAIL_PROVIDER",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "FILE_STORAGE_PROVIDER",
  "FILE_STORAGE_ROOT",
  "BLOB_PATH_PREFIX",
  "BLOB_READ_WRITE_TOKEN",
  "BACKUP_ROOT",
  "BACKUP_RETENTION_DAYS",
];

const originalEnvironment = Object.fromEntries(
  TRACKED_ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]),
);

const applyEnvironment = (values) => {
  for (const key of TRACKED_ENVIRONMENT_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }
};

const productionEnvironment = {
  NODE_ENV: "production",
  DEPLOYMENT_TARGET: "node",
  JWT_SECRET: "12345678901234567890123456789012",
  FRONTEND_URL: "https://app.example.com",
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "test-key",
  EMAIL_FROM: "SupplyFlow <no-reply@example.com>",
  FILE_STORAGE_PROVIDER: "filesystem",
  FILE_STORAGE_ROOT: path.resolve("production-storage"),
  BACKUP_ROOT: path.resolve("production-backups"),
  BACKUP_RETENTION_DAYS: "14",
};

const discreteDatabaseEnvironment = {
  DB_HOST: "localhost",
  DB_PORT: "5432",
  DB_NAME: "supplier_management",
  DB_USER: "postgres",
  DB_PASSWORD: "secret",
};

after(() => {
  for (const key of TRACKED_ENVIRONMENT_KEYS) {
    if (originalEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnvironment[key];
  }
});

test("accepts local database settings with SSL disabled", () => {
  applyEnvironment({
    ...discreteDatabaseEnvironment,
    NODE_ENV: "development",
    DEPLOYMENT_TARGET: "node",
    DB_SSL_MODE: "disable",
    JWT_SECRET: "development-secret",
    EMAIL_PROVIDER: "console",
    FILE_STORAGE_PROVIDER: "filesystem",
  });
  assert.doesNotThrow(() => validateEnvironment());
});

test("accepts production database settings with TLS, durable storage, and backups", () => {
  applyEnvironment({
    ...discreteDatabaseEnvironment,
    ...productionEnvironment,
    DB_SSL_MODE: "require",
    LOG_LEVEL: "info",
    READINESS_TIMEOUT_MS: "3000",
    SHUTDOWN_TIMEOUT_MS: "10000",
  });
  assert.doesNotThrow(() => validateEnvironment());
});

test("accepts a managed DATABASE_URL with sslmode", () => {
  applyEnvironment({
    ...productionEnvironment,
    DATABASE_URL:
      "postgresql://user:password@db.example.com:5432/supplyflow?sslmode=require",
    DATABASE_URL_UNPOOLED:
      "postgresql://user:password@direct.example.com:5432/supplyflow?sslmode=require",
  });
  assert.doesNotThrow(() => validateEnvironment());
});

test("accepts Vercel production with private Blob and no filesystem roots", () => {
  applyEnvironment({
    NODE_ENV: "production",
    DEPLOYMENT_TARGET: "vercel",
    VERCEL: "1",
    DATABASE_URL:
      "postgresql://user:password@pooler.example.com:5432/supplyflow?sslmode=require",
    DATABASE_URL_UNPOOLED:
      "postgresql://user:password@direct.example.com:5432/supplyflow?sslmode=require",
    DB_POOL_MAX: "3",
    DB_IDLE_TIMEOUT_MS: "10000",
    DB_CONNECTION_TIMEOUT_MS: "5000",
    JWT_SECRET: "12345678901234567890123456789012",
    FRONTEND_URL: "https://supplyflow-demo.vercel.app",
    EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "test-key",
    EMAIL_FROM: "SupplyFlow <no-reply@example.com>",
    FILE_STORAGE_PROVIDER: "vercel-blob",
    BLOB_PATH_PREFIX: "supplyflow/demo",
  });
  assert.doesNotThrow(() => validateEnvironment());
});

test("rejects filesystem storage for Vercel production", () => {
  applyEnvironment({
    ...productionEnvironment,
    DEPLOYMENT_TARGET: "vercel",
    DATABASE_URL:
      "postgresql://user:password@pooler.example.com:5432/supplyflow?sslmode=require",
  });
  assert.throws(
    () => validateEnvironment(),
    /FILE_STORAGE_PROVIDER must be vercel-blob when DEPLOYMENT_TARGET=vercel/,
  );
});

test("requires a Blob token when vercel-blob runs outside Vercel", () => {
  applyEnvironment({
    NODE_ENV: "production",
    DEPLOYMENT_TARGET: "node",
    DATABASE_URL:
      "postgresql://user:password@db.example.com:5432/supplyflow?sslmode=require",
    JWT_SECRET: "12345678901234567890123456789012",
    FRONTEND_URL: "https://app.example.com",
    EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "test-key",
    EMAIL_FROM: "SupplyFlow <no-reply@example.com>",
    FILE_STORAGE_PROVIDER: "vercel-blob",
  });
  assert.throws(
    () => validateEnvironment(),
    /BLOB_READ_WRITE_TOKEN is required for vercel-blob outside Vercel runtime/,
  );
});

test("rejects disabled PostgreSQL TLS in production", () => {
  applyEnvironment({
    ...discreteDatabaseEnvironment,
    ...productionEnvironment,
    DB_SSL_MODE: "disable",
  });
  assert.throws(
    () => validateEnvironment(),
    /DB_SSL_MODE cannot be disable in production/,
  );
});

test("rejects duplicate PostgreSQL SSL configuration", () => {
  applyEnvironment({
    ...productionEnvironment,
    DATABASE_URL:
      "postgresql://user:password@db.example.com:5432/supplyflow?sslmode=require",
    DB_SSL_MODE: "verify-full",
  });
  assert.throws(
    () => validateEnvironment(),
    /Configure PostgreSQL SSL either with DB_SSL_MODE or SSL parameters in DATABASE_URL/,
  );
});

test("rejects invalid production runtime settings", () => {
  applyEnvironment({
    ...discreteDatabaseEnvironment,
    ...productionEnvironment,
    DB_SSL_MODE: "require",
    LOG_LEVEL: "verbose",
    READINESS_TIMEOUT_MS: "0",
    SHUTDOWN_TIMEOUT_MS: "not-a-number",
    BACKUP_RETENTION_DAYS: "0",
    DB_POOL_MAX: "0",
  });
  assert.throws(
    () => validateEnvironment(),
    /LOG_LEVEL must be debug, info, warn, error, or silent/,
  );
  assert.throws(
    () => validateEnvironment(),
    /READINESS_TIMEOUT_MS must be a positive integer/,
  );
  assert.throws(
    () => validateEnvironment(),
    /SHUTDOWN_TIMEOUT_MS must be a positive integer/,
  );
  assert.throws(
    () => validateEnvironment(),
    /BACKUP_RETENTION_DAYS must be a positive integer/,
  );
  assert.throws(
    () => validateEnvironment(),
    /DB_POOL_MAX must be a positive integer/,
  );
});

test("production filesystem storage requires an absolute file storage root", () => {
  applyEnvironment({
    ...discreteDatabaseEnvironment,
    ...productionEnvironment,
    DB_SSL_MODE: "require",
    FILE_STORAGE_ROOT: "",
  });
  assert.throws(
    () => validateEnvironment(),
    /FILE_STORAGE_ROOT is required in production/,
  );

  applyEnvironment({
    ...discreteDatabaseEnvironment,
    ...productionEnvironment,
    DB_SSL_MODE: "require",
    FILE_STORAGE_ROOT: "relative-storage",
  });
  assert.throws(
    () => validateEnvironment(),
    /FILE_STORAGE_ROOT must be an absolute path in production/,
  );
});

test("production filesystem storage requires a separate absolute backup root", () => {
  applyEnvironment({
    ...discreteDatabaseEnvironment,
    ...productionEnvironment,
    DB_SSL_MODE: "require",
    BACKUP_ROOT: "",
  });
  assert.throws(
    () => validateEnvironment(),
    /BACKUP_ROOT is required in production/,
  );

  applyEnvironment({
    ...discreteDatabaseEnvironment,
    ...productionEnvironment,
    DB_SSL_MODE: "require",
    BACKUP_ROOT: "relative-backups",
  });
  assert.throws(
    () => validateEnvironment(),
    /BACKUP_ROOT must be an absolute path in production/,
  );

  applyEnvironment({
    ...discreteDatabaseEnvironment,
    ...productionEnvironment,
    DB_SSL_MODE: "require",
    BACKUP_ROOT: path.join(
      productionEnvironment.FILE_STORAGE_ROOT,
      "backups",
    ),
  });
  assert.throws(
    () => validateEnvironment(),
    /BACKUP_ROOT must be separate from FILE_STORAGE_ROOT/,
  );
});
