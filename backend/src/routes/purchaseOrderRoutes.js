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
const {
  createSupplierPayment,
} = require("../controllers/supplierPaymentController");
const {
  addSupplierPaymentProofs,
  deleteSupplierPaymentProof,
  replaceSupplierPaymentProof,
  serveSupplierPaymentProof,
} = require("../controllers/paymentProofController");
const {
  uploadProofs,
  uploadReplacementProof,
} = require("../services/paymentProofService");

const router = express.Router();

router.post(
  "/:purchaseOrderId/supplier-payments",
  authorizeRoles("ADMIN", "FINANCE"),
  uploadProofs,
  createSupplierPayment,
);

router.post(
  "/:purchaseOrderId/supplier-payments/:paymentId/proofs",
  authorizeRoles("ADMIN", "FINANCE"),
  uploadProofs,
  addSupplierPaymentProofs,
);

router.put(
  "/:purchaseOrderId/supplier-payments/:paymentId/proofs/:proofId",
  authorizeRoles("ADMIN", "FINANCE"),
  uploadReplacementProof,
  replaceSupplierPaymentProof,
);

router.delete(
  "/:purchaseOrderId/supplier-payments/:paymentId/proofs/:proofId",
  authorizeRoles("ADMIN", "FINANCE"),
  deleteSupplierPaymentProof,
);

router.get(
  "/:purchaseOrderId/supplier-payments/:paymentId/proofs/:proofId/content",
  authorizeRoles("ADMIN", "PURCHASING", "FINANCE", "MANAGER"),
  serveSupplierPaymentProof,
);

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
