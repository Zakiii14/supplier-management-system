const express = require("express");

const authorizeRoles = require(
  "../middleware/authorizeRoles"
);

const {
  getAllPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
} = require("../controllers/purchaseOrderController");

const router = express.Router();

router.get(
  "/",
  authorizeRoles(
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER"
  ),
  getAllPurchaseOrders
);

router.get(
  "/:id",
  authorizeRoles(
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER"
  ),
  getPurchaseOrderById
);

router.post(
  "/",
  authorizeRoles("ADMIN", "PURCHASING"),
  createPurchaseOrder
);

router.patch(
  "/:id/status",
  authorizeRoles("ADMIN", "PURCHASING"),
  updatePurchaseOrderStatus
);

module.exports = router;