const express = require("express");

const authorizeRoles = require(
  "../middleware/authorizeRoles",
);

const {
  getDashboardSummary,
} = require(
  "../controllers/dashboardController",
);

const {
  getDashboardTrends,
} = require(
  "../controllers/dashboardTrendController",
);

const router = express.Router();

const authorizeDashboardRoles = authorizeRoles(
  "ADMIN",
  "PURCHASING",
  "WAREHOUSE",
  "SALES",
  "FINANCE",
  "MANAGER",
);

router.get(
  "/summary",
  authorizeDashboardRoles,
  getDashboardSummary,
);

router.get(
  "/trends",
  authorizeDashboardRoles,
  getDashboardTrends,
);

module.exports = router;