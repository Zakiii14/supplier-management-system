const multer = require("multer");
const logger = require("../utils/logger");

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Ukuran file maksimal 2 MB"
          : "File impor tidak dapat diproses",
    });
  }

  const statusCode = Number.isInteger(error?.statusCode)
    ? error.statusCode
    : 500;

  if (statusCode >= 500) {
    logger.error("request_error", {
      method: req.method,
      path: req.path,
      status_code: statusCode,
      error,
    });
  }

  const message =
    statusCode >= 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : error?.message || "Internal server error";

  return res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = errorHandler;
