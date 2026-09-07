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
const {
  getSupplierFinanceReport,
} = require(
  "../controllers/supplierFinanceReportController",
);
const {
  exportPurchasingReport,
  exportSalesReport,
} = require(
  "../controllers/reportExportController",
);
const {
  exportFinanceReport,
  exportInventoryReport,
} = require(
  "../controllers/additionalReportExportController",
);
const {
  exportSupplierFinanceReport,
} = require(
  "../controllers/supplierFinanceReportExportController",
);

const {
  getCategoryReportOptions,
  getCustomerReportOptions,
  getSupplierReportOptions,
} = require(
  "../controllers/reportOptionsController",
);

const router = express.Router();

router.get(
  "/options/suppliers",
  authorizeRoles(
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER",
  ),
  getSupplierReportOptions,
);

router.get(
  "/options/categories",
  authorizeRoles(
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER",
  ),
  getCategoryReportOptions,
);

router.get(
  "/options/customers",
  authorizeRoles(
    "ADMIN",
    "SALES",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER",
  ),
  getCustomerReportOptions,
);

router.get(
  "/purchasing/export",
  authorizeRoles(
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER",
  ),
  exportPurchasingReport,
);

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
  "/inventory/export",
  authorizeRoles(
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER",
  ),
  exportInventoryReport,
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
  "/sales/export",
  authorizeRoles(
    "ADMIN",
    "SALES",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER",
  ),
  exportSalesReport,
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
  "/finance/export",
  authorizeRoles(
    "ADMIN",
    "FINANCE",
    "MANAGER",
  ),
  exportFinanceReport,
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

router.get(
  "/supplier-finance/export",
  authorizeRoles(
    "ADMIN",
    "FINANCE",
    "MANAGER",
  ),
  exportSupplierFinanceReport,
);

router.get(
  "/supplier-finance",
  authorizeRoles(
    "ADMIN",
    "FINANCE",
    "MANAGER",
  ),
  getSupplierFinanceReport,
);

module.exports = router;
