const express = require("express");
const authorizeRoles = require(
  "../middleware/authorizeRoles",
);
const {
  blockDemoMutation,
} = require("../middleware/demoModeMiddleware");
const {
  getAllCodeNumberSettings,
  getCodeNumberSetting,
  updateCodeNumberSetting,
} = require(
  "../controllers/codeNumberSettingController",
);

const router = express.Router();

router.get(
  "/",
  authorizeRoles("ADMIN"),
  getAllCodeNumberSettings,
);

router.get("/:moduleKey", getCodeNumberSetting);

router.put(
  "/:moduleKey",
  authorizeRoles("ADMIN"),
  blockDemoMutation,
  updateCodeNumberSetting,
);

module.exports = router;
