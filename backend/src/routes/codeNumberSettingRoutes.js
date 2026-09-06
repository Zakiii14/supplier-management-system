const express = require("express");
const authorizeRoles = require(
  "../middleware/authorizeRoles",
);
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
  updateCodeNumberSetting,
);

module.exports = router;
