const express = require("express");

const authorizeRoles = require(
  "../middleware/authorizeRoles",
);

const {
  getDashboardSummary,
} = require(
  "../controllers/dashboardController",
);

const router = express.Router();

router.get(
  "/summary",
  authorizeRoles(
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "SALES",
    "FINANCE",
    "MANAGER",
  ),
  getDashboardSummary,
);

module.exports = router;
