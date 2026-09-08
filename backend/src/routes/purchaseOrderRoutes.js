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
  decidePurchaseOrderApproval,
  getPurchaseOrderApprovalHistory,
  submitPurchaseOrderApproval,
} = require("../controllers/orderApprovalController");
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

router.get(
  "/:id/approval-history",
  authorizeRoles("ADMIN", "PURCHASING", "WAREHOUSE", "FINANCE", "MANAGER"),
  getPurchaseOrderApprovalHistory,
);

router.post(
  "/:id/approval/submit",
  authorizeRoles("ADMIN", "PURCHASING"),
  submitPurchaseOrderApproval,
);

router.post(
  "/:id/approval/decision",
  authorizeRoles("ADMIN", "MANAGER"),
  decidePurchaseOrderApproval,
);

router.patch(
  "/:id/status",
  authorizeRoles("ADMIN", "PURCHASING"),
  updatePurchaseOrderStatus
);

module.exports = router;
