const pool = require("../config/database");
const logger = require("../utils/logger");

const DEFAULT_READINESS_TIMEOUT_MS = 3000;

const getReadinessTimeoutMs = () => {
  const configured = Number(process.env.READINESS_TIMEOUT_MS);

  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_READINESS_TIMEOUT_MS;
};

const health = (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
  });
};

const readiness = async (req, res) => {
  const timeoutMs = getReadinessTimeoutMs();
  let timeoutHandle;

  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const error = new Error("Database readiness check timed out");
        error.code = "READINESS_TIMEOUT";
        reject(error);
      }, timeoutMs);
    });

    await Promise.race([pool.query("SELECT 1"), timeoutPromise]);

    return res.status(200).json({
      success: true,
      status: "ready",
      dependencies: {
        database: "up",
      },
    });
  } catch (error) {
    logger.warn("readiness_check_failed", { error });

    return res.status(503).json({
      success: false,
      status: "not_ready",
      dependencies: {
        database: "down",
      },
    });
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

module.exports = {
  health,
  readiness,
};
