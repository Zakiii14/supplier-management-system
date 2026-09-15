const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: Number.POSITIVE_INFINITY,
};

const getConfiguredLevel = () => {
  const configured = (process.env.LOG_LEVEL || "info").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, configured)
    ? configured
    : "info";
};

const serializeError = (error) => {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    code: error.code,
    stack: error.stack,
  };
};

const normalizeMetadata = (metadata = {}) => {
  const normalized = { ...metadata };

  if (normalized.error instanceof Error) {
    normalized.error = serializeError(normalized.error);
  }

  return normalized;
};

const writeLog = (level, event, metadata) => {
  const configuredLevel = getConfiguredLevel();

  if (LEVELS[level] < LEVELS[configuredLevel]) {
    return;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...normalizeMetadata(metadata),
  };
  const message = JSON.stringify(entry);

  if (level === "error") {
    console.error(message);
    return;
  }

  if (level === "warn") {
    console.warn(message);
    return;
  }

  console.log(message);
};

module.exports = {
  debug: (event, metadata) => writeLog("debug", event, metadata),
  info: (event, metadata) => writeLog("info", event, metadata),
  warn: (event, metadata) => writeLog("warn", event, metadata),
  error: (event, metadata) => writeLog("error", event, metadata),
  serializeError,
};
