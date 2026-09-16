const path = require("node:path");

const DATABASE_SSL_QUERY_KEYS = [
  "sslmode",
  "sslcert",
  "sslkey",
  "sslrootcert",
];
const SUPPORTED_DB_SSL_MODES = new Set([
  "disable",
  "require",
  "verify-full",
]);
const INSECURE_DATABASE_URL_SSL_MODES = new Set([
  "disable",
  "allow",
  "prefer",
]);
const SUPPORTED_LOG_LEVELS = new Set([
  "debug",
  "info",
  "warn",
  "error",
  "silent",
]);
const POSITIVE_INTEGER_RUNTIME_VARIABLES = [
  "READINESS_TIMEOUT_MS",
  "SHUTDOWN_TIMEOUT_MS",
  "BACKUP_RETENTION_DAYS",
];

const parseDatabaseUrl = (value) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
};

const pathsOverlap = (left, right) => {
  const resolvedLeft = path.resolve(left);
  const resolvedRight = path.resolve(right);
  const leftToRight = path.relative(resolvedLeft, resolvedRight);
  const rightToLeft = path.relative(resolvedRight, resolvedLeft);
  const isContained = (relative) =>
    relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  return isContained(leftToRight) || isContained(rightToLeft);
};

const validateEnvironment = () => {
  const errors = [];
  const isProduction = process.env.NODE_ENV === "production";
  const jwtSecret = process.env.JWT_SECRET || "";
  const emailProvider = (process.env.EMAIL_PROVIDER || "console").toLowerCase();
  const frontendUrl = process.env.FRONTEND_URL || "";
  const databaseUrl = (process.env.DATABASE_URL || "").trim();
  const parsedDatabaseUrl = parseDatabaseUrl(databaseUrl);
  const dbSslMode = (process.env.DB_SSL_MODE || "").trim().toLowerCase();
  const logLevel = (process.env.LOG_LEVEL || "").trim().toLowerCase();
  const fileStorageRoot = String(process.env.FILE_STORAGE_ROOT || "").trim();
  const backupRoot = String(process.env.BACKUP_ROOT || "").trim();

  if (!databaseUrl) {
    for (const variable of ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"]) {
      if (!process.env[variable]) {
        errors.push(`${variable} is required when DATABASE_URL is not configured`);
      }
    }
    if (
      process.env.DB_PORT &&
      (!Number.isInteger(Number(process.env.DB_PORT)) || Number(process.env.DB_PORT) <= 0)
    ) {
      errors.push("DB_PORT must be a positive integer");
    }
  } else if (!parsedDatabaseUrl) {
    errors.push("DATABASE_URL must be a valid PostgreSQL connection URL");
  }

  if (dbSslMode && !SUPPORTED_DB_SSL_MODES.has(dbSslMode)) {
    errors.push("DB_SSL_MODE must be disable, require, or verify-full");
  }

  if (parsedDatabaseUrl && dbSslMode) {
    const hasSslOptions = DATABASE_SSL_QUERY_KEYS.some((key) =>
      parsedDatabaseUrl.searchParams.has(key),
    );
    if (hasSslOptions) {
      errors.push(
        "Configure PostgreSQL SSL either with DB_SSL_MODE or SSL parameters in DATABASE_URL, not both",
      );
    }
  }

  if (isProduction) {
    if (dbSslMode === "disable") {
      errors.push("DB_SSL_MODE cannot be disable in production");
    }
    const connectionStringSslMode = parsedDatabaseUrl?.searchParams
      .get("sslmode")
      ?.toLowerCase();
    if (
      connectionStringSslMode &&
      INSECURE_DATABASE_URL_SSL_MODES.has(connectionStringSslMode)
    ) {
      errors.push(
        `DATABASE_URL sslmode=${connectionStringSslMode} is not allowed in production`,
      );
    }
    if (!fileStorageRoot) {
      errors.push("FILE_STORAGE_ROOT is required in production");
    } else if (!path.isAbsolute(fileStorageRoot)) {
      errors.push("FILE_STORAGE_ROOT must be an absolute path in production");
    }
    if (!backupRoot) {
      errors.push("BACKUP_ROOT is required in production");
    } else if (!path.isAbsolute(backupRoot)) {
      errors.push("BACKUP_ROOT must be an absolute path in production");
    }
    if (
      path.isAbsolute(fileStorageRoot) &&
      path.isAbsolute(backupRoot) &&
      pathsOverlap(fileStorageRoot, backupRoot)
    ) {
      errors.push("BACKUP_ROOT must be separate from FILE_STORAGE_ROOT");
    }
  }

  if (logLevel && !SUPPORTED_LOG_LEVELS.has(logLevel)) {
    errors.push("LOG_LEVEL must be debug, info, warn, error, or silent");
  }

  for (const variable of POSITIVE_INTEGER_RUNTIME_VARIABLES) {
    if (
      process.env[variable] &&
      (!Number.isInteger(Number(process.env[variable])) || Number(process.env[variable]) <= 0)
    ) {
      errors.push(`${variable} must be a positive integer`);
    }
  }

  if (!jwtSecret) errors.push("JWT_SECRET is required");
  if (isProduction && jwtSecret.length < 32) {
    errors.push("JWT_SECRET must contain at least 32 characters in production");
  }
  if (isProduction && !frontendUrl) {
    errors.push("FRONTEND_URL is required in production");
  }
  if (isProduction && frontendUrl && !frontendUrl.startsWith("https://")) {
    errors.push("FRONTEND_URL must use HTTPS in production");
  }
  if (isProduction && emailProvider === "console") {
    errors.push("EMAIL_PROVIDER cannot be console in production");
  }

  if (emailProvider === "resend") {
    if (!process.env.RESEND_API_KEY) {
      errors.push("RESEND_API_KEY is required when EMAIL_PROVIDER=resend");
    }
    if (!process.env.EMAIL_FROM) {
      errors.push("EMAIL_FROM is required when EMAIL_PROVIDER=resend");
    }
  }
  if (!["console", "resend"].includes(emailProvider)) {
    errors.push(`Unsupported EMAIL_PROVIDER: ${emailProvider}`);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n- ${errors.join("\n- ")}`);
  }
};

module.exports = validateEnvironment;
