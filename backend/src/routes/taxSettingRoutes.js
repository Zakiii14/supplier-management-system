const express = require("express");
const authorizeRoles = require("../middleware/authorizeRoles");
const {
  blockDemoMutation,
} = require("../middleware/demoModeMiddleware");
const {
  getTaxSettings,
  updateTaxSettings,
} = require("../controllers/taxSettingController");

const router = express.Router();

router.get(
  "/",
  authorizeRoles("ADMIN", "FINANCE", "SALES", "MANAGER"),
  getTaxSettings,
);
router.put(
  "/",
  authorizeRoles("ADMIN"),
  blockDemoMutation,
  updateTaxSettings,
);

module.exports = router;
