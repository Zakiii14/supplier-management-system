const express = require("express");
const authorizeRoles = require("../middleware/authorizeRoles");
const {
  blockDemoMutation,
} = require("../middleware/demoModeMiddleware");
const {
  getPaymentSettings,
  updatePaymentSettings,
} = require("../controllers/paymentSettingController");

const router = express.Router();

router.get(
  "/",
  authorizeRoles(
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER",
  ),
  getPaymentSettings,
);

router.put(
  "/",
  authorizeRoles("ADMIN"),
  blockDemoMutation,
  updatePaymentSettings,
);

module.exports = router;
