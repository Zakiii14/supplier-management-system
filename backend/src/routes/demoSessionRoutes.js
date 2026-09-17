const express = require("express");

const {
  endDemoSession,
  isDemoMode,
  touchDemoSession,
} = require("../services/demoSessionService");

const router = express.Router();

router.use((req, res, next) => {
  if (!isDemoMode()) {
    return res.status(404).json({
      success: false,
      message: "Endpoint not found",
    });
  }

  next();
});

router.post("/heartbeat", async (req, res, next) => {
  try {
    await touchDemoSession({
      clientId: req.body?.client_id,
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

router.post("/end", async (req, res, next) => {
  try {
    const result = await endDemoSession({
      clientId: req.body?.client_id,
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
