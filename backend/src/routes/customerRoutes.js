const express = require("express");

const authorizeRoles = require(
  "../middleware/authorizeRoles"
);

const {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  updateCustomerStatus,
} = require("../controllers/customerController");

const router = express.Router();

router.get(
  "/",
  authorizeRoles(
    "ADMIN",
    "SALES",
    "FINANCE",
    "MANAGER"
  ),
  getAllCustomers
);

router.get(
  "/:id",
  authorizeRoles(
    "ADMIN",
    "SALES",
    "FINANCE",
    "MANAGER"
  ),
  getCustomerById
);

router.post(
  "/",
  authorizeRoles("ADMIN", "SALES"),
  createCustomer
);

router.put(
  "/:id",
  authorizeRoles("ADMIN", "SALES"),
  updateCustomer
);

router.patch(
  "/:id/status",
  authorizeRoles("ADMIN", "SALES"),
  updateCustomerStatus
);

module.exports = router;