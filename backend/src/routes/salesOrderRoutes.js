const express = require("express");

const {
  getAllSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateSalesOrderStatus,
} = require(
  "../controllers/salesOrderController"
);

const router = express.Router();

router.get("/", getAllSalesOrders);
router.get("/:id", getSalesOrderById);
router.post("/", createSalesOrder);
router.patch("/:id/status", updateSalesOrderStatus);

module.exports = router;