const express = require("express");

const authenticate = require("../middleware/authMiddleware");
const {
  endDemoSession,
  isDemoMode,
  maybeResetStaleDemo,
  touchDemoSession,
} = require("../services/demoSessionService");

const createRateLimiter = require("../middleware/rateLimitMiddleware");
const router = express.Router();
const prepareLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: "Terlalu banyak permintaan demo. Silakan coba lagi nanti.",
});

router.use((req, res, next) => {
  if (!isDemoMode()) {
    return res.status(404).json({
      success: false,
      message: "Endpoint not found",
    });
  }

  next();
});

router.post("/prepare", prepareLimiter, async (req, res, next) => {
  try {
    const result = await maybeResetStaleDemo({
      reason: "prepare_login",
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/heartbeat", authenticate, async (req, res, next) => {
  try {
    if (typeof req.body?.client_id !== "string" || req.body.client_id.trim().toLowerCase() !== req.demoSession.clientId) {
      return res.status(400).json({ success: false, message: "Demo client id tidak cocok." });
    }
    await touchDemoSession({
      clientId: req.body?.client_id,
      sessionId: req.demoSession.sessionId,
      userId: req.user.id,
    });

    return res.status(204).end();
  } catch (error) {
    if (error.code === "INVALID_DEMO_CLIENT_ID") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  }
});

router.post("/end", authenticate, async (req, res, next) => {
  try {
    if (typeof req.body?.client_id !== "string" || req.body.client_id.trim().toLowerCase() !== req.demoSession.clientId) {
      return res.status(400).json({ success: false, message: "Demo client id tidak cocok." });
    }
    const result = await endDemoSession({
      clientId: req.body?.client_id,
      sessionId: req.demoSession.sessionId,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error.code === "INVALID_DEMO_CLIENT_ID") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  }
});

module.exports = router;
