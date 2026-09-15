require("dotenv").config();

const validateEnvironment = require("./config/validateEnvironment");
const logger = require("./utils/logger");

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10000;

const getShutdownTimeoutMs = () => {
  const configured = Number(process.env.SHUTDOWN_TIMEOUT_MS);

  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_SHUTDOWN_TIMEOUT_MS;
};

const createGracefulShutdown = ({
  server,
  databasePool,
  timeoutMs = getShutdownTimeoutMs(),
  exit = process.exit,
}) => {
  let shutdownPromise = null;

  return (signal) => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      logger.info("shutdown_started", { signal });

      const forcedExitTimer = setTimeout(() => {
        logger.error("shutdown_timeout", {
          signal,
          timeout_ms: timeoutMs,
        });
        exit(1);
      }, timeoutMs);
      forcedExitTimer.unref?.();

      const errors = [];

      try {
        await new Promise((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        });
      } catch (error) {
        errors.push(error);
      }

      try {
        await databasePool.end();
      } catch (error) {
        errors.push(error);
      }

      clearTimeout(forcedExitTimer);

      if (errors.length > 0) {
        logger.error("shutdown_failed", {
          signal,
          error: errors[0],
          error_count: errors.length,
        });
        exit(1);
        return;
      }

      logger.info("shutdown_completed", { signal });
      exit(0);
    })();

    return shutdownPromise;
  };
};

const startServer = () => {
  validateEnvironment();

  const app = require("./app");
  const databasePool = require("./config/database");
  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, () => {
    logger.info("server_started", {
      port,
      environment: process.env.NODE_ENV || "development",
    });
  });

  const shutdown = createGracefulShutdown({
    server,
    databasePool,
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  server.once("error", (error) => {
    logger.error("server_error", { error });
    process.exitCode = 1;
  });

  return server;
};

if (require.main === module) {
  try {
    startServer();
  } catch (error) {
    logger.error("server_start_failed", { error });
    process.exitCode = 1;
  }
}

module.exports = {
  createGracefulShutdown,
  startServer,
};
