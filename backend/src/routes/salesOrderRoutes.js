const express = require("express");

const authorizeRoles = require(
  "../middleware/authorizeRoles"
);

const {
  getAllSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateSalesOrderStatus,
} = require(
  "../controllers/salesOrderController"
);
const {
  decideSalesOrderApproval,
  getSalesOrderApprovalHistory,
  submitSalesOrderApproval,
} = require("../controllers/orderApprovalController");

const router = express.Router();

router.get(
  "/",
  authorizeRoles(
    "ADMIN",
    "SALES",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER"
  ),
  getAllSalesOrders
);

router.get(
  "/:id",
  authorizeRoles(
    "ADMIN",
    "SALES",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER"
  ),
  getSalesOrderById
);

router.post(
  "/",
  authorizeRoles("ADMIN", "SALES"),
  createSalesOrder
);

router.get(
  "/:id/approval-history",
  authorizeRoles("ADMIN", "SALES", "WAREHOUSE", "FINANCE", "MANAGER"),
  getSalesOrderApprovalHistory,
);

router.post(
  "/:id/approval/submit",
  authorizeRoles("ADMIN", "SALES"),
  submitSalesOrderApproval,
);

router.post(
  "/:id/approval/decision",
  authorizeRoles("ADMIN", "MANAGER"),
  decideSalesOrderApproval,
);

router.patch(
  "/:id/status",
  authorizeRoles("ADMIN", "SALES"),
  updateSalesOrderStatus
);

module.exports = router;
