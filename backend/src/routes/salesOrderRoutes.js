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

router.patch(
  "/:id/status",
  authorizeRoles("ADMIN", "SALES"),
  updateSalesOrderStatus
);

module.exports = router;