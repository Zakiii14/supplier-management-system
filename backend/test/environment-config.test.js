const assert = require("node:assert/strict");
const { after, test } = require("node:test");

const validateEnvironment = require("../src/config/validateEnvironment");

const TRACKED_ENVIRONMENT_KEYS = [
  "NODE_ENV",
  "DATABASE_URL",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "DB_SSL_MODE",
  "DB_SSL_CA",
  "JWT_SECRET",
  "FRONTEND_URL",
  "EMAIL_PROVIDER",
  "RESEND_API_KEY",
  "EMAIL_FROM",
];

const originalEnvironment = Object.fromEntries(
  TRACKED_ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]),
);

const applyEnvironment = (values) => {
  for (const key of TRACKED_ENVIRONMENT_KEYS) {
    delete process.env[key];
  }

  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }
};

const productionEnvironment = {
  NODE_ENV: "production",
  JWT_SECRET: "12345678901234567890123456789012",
  FRONTEND_URL: "https://app.example.com",
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "test-key",
  EMAIL_FROM: "SupplyFlow <no-reply@example.com>",
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
    if (originalEnvironment[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnvironment[key];
    }
  }
});

test("accepts local database settings with SSL disabled", () => {
  applyEnvironment({
    ...discreteDatabaseEnvironment,
    NODE_ENV: "development",
    DB_SSL_MODE: "disable",
    JWT_SECRET: "development-secret",
    EMAIL_PROVIDER: "console",
  });

  assert.doesNotThrow(() => validateEnvironment());
});

test("accepts production database settings with TLS required", () => {
  applyEnvironment({
    ...discreteDatabaseEnvironment,
    ...productionEnvironment,
    DB_SSL_MODE: "require",
  });

  assert.doesNotThrow(() => validateEnvironment());
});

test("accepts a managed DATABASE_URL with sslmode", () => {
  applyEnvironment({
    ...productionEnvironment,
    DATABASE_URL:
      "postgresql://user:password@db.example.com:5432/supplyflow?sslmode=require",
  });

  assert.doesNotThrow(() => validateEnvironment());
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
