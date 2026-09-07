const express = require("express");

const authorizeRoles = require(
  "../middleware/authorizeRoles",
);

const {
  getAllPayments,
  getPaymentEligibleInvoices,
  getPaymentById,
  createPayment,
} = require("../controllers/paymentController");
const {
  addCustomerPaymentProofs,
  deleteCustomerPaymentProof,
  replaceCustomerPaymentProof,
  serveCustomerPaymentProof,
} = require("../controllers/paymentProofController");
const {
  uploadProofs,
  uploadReplacementProof,
} = require("../services/paymentProofService");

const router = express.Router();

router.get(
  "/",
  authorizeRoles(
    "ADMIN",
    "FINANCE",
    "MANAGER",
  ),
  getAllPayments,
);

router.get(
  "/eligible-invoices",
  authorizeRoles(
    "ADMIN",
    "FINANCE",
    "MANAGER",
  ),
  getPaymentEligibleInvoices,
);

router.post(
  "/:id/proofs",
  authorizeRoles("ADMIN", "FINANCE"),
  uploadProofs,
  addCustomerPaymentProofs,
);

router.put(
  "/:id/proofs/:proofId",
  authorizeRoles("ADMIN", "FINANCE"),
  uploadReplacementProof,
  replaceCustomerPaymentProof,
);

router.delete(
  "/:id/proofs/:proofId",
  authorizeRoles("ADMIN", "FINANCE"),
  deleteCustomerPaymentProof,
);

router.get(
  "/:id/proofs/:proofId/content",
  authorizeRoles("ADMIN", "FINANCE", "MANAGER"),
  serveCustomerPaymentProof,
);

router.get(
  "/:id",
  authorizeRoles(
    "ADMIN",
    "FINANCE",
    "MANAGER",
  ),
  getPaymentById,
);

router.post(
  "/",
  authorizeRoles("ADMIN", "FINANCE"),
  uploadProofs,
  createPayment,
);

module.exports = router;
