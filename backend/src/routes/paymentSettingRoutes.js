const express = require("express");
const authorizeRoles = require("../middleware/authorizeRoles");
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
  updatePaymentSettings,
);

module.exports = router;
