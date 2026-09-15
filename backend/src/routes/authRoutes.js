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

const router = express.Router();

router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.get(
  "/reset-password/validate",
  validatePasswordResetToken,
);
router.post("/reset-password", resetPassword);
router.get(
  "/activate-account/validate",
  validateActivationToken,
);
router.post("/activate-account", activateAccount);
router.get("/me", authenticate, getCurrentUser);

module.exports = router;
