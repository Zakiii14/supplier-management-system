const express = require("express");

const {
  getAllPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
} = require("../controllers/purchaseOrderController");

const router = express.Router();

router.get("/", getAllPurchaseOrders);
router.post("/", createPurchaseOrder);

router.get("/:id", getPurchaseOrderById);
router.patch("/:id/status", updatePurchaseOrderStatus);

module.exports = router;