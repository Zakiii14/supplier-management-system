const express = require("express");

const {
  login,
  forgotPassword,
  validatePasswordResetToken,
  resetPassword,
  validateActivationToken,
  activateAccount,
  getCurrentUser,
} = require("../controllers/authController");

const authenticate = require(
  "../middleware/authMiddleware"
);
const createRateLimiter = require(
  "../middleware/rateLimitMiddleware"
);

const router = express.Router();

const isProduction = process.env.NODE_ENV === "production";

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX) ||
    (isProduction ? 10 : 250),
  message: "Terlalu banyak percobaan login. Silakan coba lagi nanti.",
});

const recoveryLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RECOVERY_RATE_LIMIT_MAX) ||
    (isProduction ? 10 : 250),
  message: "Terlalu banyak permintaan autentikasi. Silakan coba lagi nanti.",
});

router.post("/login", loginLimiter, login);
router.post("/forgot-password", recoveryLimiter, forgotPassword);
router.get(
  "/reset-password/validate",
  recoveryLimiter,
  validatePasswordResetToken,
);
router.post(
  "/reset-password",
  recoveryLimiter,
  resetPassword,
);
router.get(
  "/activate-account/validate",
  recoveryLimiter,
  validateActivationToken,
);
router.post(
  "/activate-account",
  recoveryLimiter,
  activateAccount,
);
router.get("/me", authenticate, getCurrentUser);

module.exports = router;
