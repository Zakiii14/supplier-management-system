const express = require("express");

const authorizeRoles = require(
  "../middleware/authorizeRoles",
);

const {
  getPurchasingReport,
} = require(
  "../controllers/purchasingReportController",
);
const {
  getInventoryReport,
} = require(
  "../controllers/inventoryReportController",
);
const {
  getSalesReport,
} = require(
  "../controllers/salesReportController",
);
const {
  getFinanceReport,
} = require(
  "../controllers/financeReportController",
);

const router = express.Router();

router.get(
  "/purchasing",
  authorizeRoles(
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER",
  ),
  getPurchasingReport,
);

router.get(
  "/inventory",
  authorizeRoles(
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER",
  ),
  getInventoryReport,
);

router.get(
  "/sales",
  authorizeRoles(
    "ADMIN",
    "SALES",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER",
  ),
  getSalesReport,
);

router.get(
  "/finance",
  authorizeRoles(
    "ADMIN",
    "FINANCE",
    "MANAGER",
  ),
  getFinanceReport,
);

module.exports = router;
