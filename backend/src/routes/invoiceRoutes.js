const express = require("express");

const authorizeRoles = require(
  "../middleware/authorizeRoles"
);

const {
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  cancelInvoice,
} = require("../controllers/invoiceController");

const router = express.Router();

router.get(
  "/",
  authorizeRoles(
    "ADMIN",
    "FINANCE",
    "SALES",
    "MANAGER"
  ),
  getAllInvoices
);

router.get(
  "/:id",
  authorizeRoles(
    "ADMIN",
    "FINANCE",
    "SALES",
    "MANAGER"
  ),
  getInvoiceById
);

router.post(
  "/",
  authorizeRoles("ADMIN", "FINANCE"),
  createInvoice
);

router.patch(
  "/:id/cancel",
  authorizeRoles("ADMIN", "FINANCE"),
  cancelInvoice
);

module.exports = router;