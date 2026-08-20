const express = require("express");

const {
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  cancelInvoice,
} = require("../controllers/invoiceController");

const router = express.Router();

router.get("/", getAllInvoices);
router.get("/:id", getInvoiceById);
router.post("/", createInvoice);
router.patch("/:id/cancel", cancelInvoice);

module.exports = router;