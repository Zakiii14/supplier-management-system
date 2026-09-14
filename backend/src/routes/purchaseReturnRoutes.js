const express = require("express");
const authorizeRoles = require("../middleware/authorizeRoles");
const {
  cancelPurchaseReturn,
  createPurchaseReturn,
  createPurchaseReturnSettlement,
  decidePurchaseReturn,
  getAllPurchaseReturns,
  getPurchaseReturnById,
  getSettlementInvoices,
  getReturnableGoodsReceiptItems,
  getReturnableGoodsReceipts,
  submitPurchaseReturn,
} = require("../controllers/purchaseReturnController");

const router = express.Router();

const VIEW_ROLES = ["ADMIN", "PURCHASING", "WAREHOUSE", "FINANCE", "MANAGER"];
const CREATE_ROLES = ["ADMIN", "PURCHASING", "WAREHOUSE"];

router.get("/", authorizeRoles(...VIEW_ROLES), getAllPurchaseReturns);
router.get("/goods-receipts", authorizeRoles(...CREATE_ROLES), getReturnableGoodsReceipts);
router.get("/goods-receipts/:id/items", authorizeRoles(...CREATE_ROLES), getReturnableGoodsReceiptItems);
router.get("/:id/settlement-invoices", authorizeRoles(...VIEW_ROLES), getSettlementInvoices);
router.get("/:id", authorizeRoles(...VIEW_ROLES), getPurchaseReturnById);
router.post("/", authorizeRoles(...CREATE_ROLES), createPurchaseReturn);
router.post("/:id/submit", authorizeRoles(...CREATE_ROLES), submitPurchaseReturn);
router.post("/:id/decision", authorizeRoles("ADMIN", "MANAGER"), decidePurchaseReturn);
router.patch("/:id/cancel", authorizeRoles(...CREATE_ROLES), cancelPurchaseReturn);
router.post("/:id/settlements", authorizeRoles("ADMIN", "FINANCE"), createPurchaseReturnSettlement);

module.exports = router;
