const express = require("express");

const authorizeRoles = require(
  "../middleware/authorizeRoles"
);

const {
  getAllPayments,
  getPaymentById,
  createPayment,
} = require("../controllers/paymentController");

const router = express.Router();

router.get(
  "/",
  authorizeRoles(
    "ADMIN",
    "FINANCE",
    "MANAGER"
  ),
  getAllPayments
);

router.get(
  "/:id",
  authorizeRoles(
    "ADMIN",
    "FINANCE",
    "MANAGER"
  ),
  getPaymentById
);

router.post(
  "/",
  authorizeRoles("ADMIN", "FINANCE"),
  createPayment
);

module.exports = router;