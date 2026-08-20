const express = require("express");

const {
  getAllPayments,
  getPaymentById,
  createPayment,
} = require("../controllers/paymentController");

const router = express.Router();

router.get("/", getAllPayments);
router.get("/:id", getPaymentById);
router.post("/", createPayment);

module.exports = router;