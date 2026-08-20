const express = require("express");

const {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  updateSupplierStatus,
} = require(
  "../controllers/supplierController"
);

const authorizeRoles = require(
  "../middleware/authorizeRoles"
);

const router = express.Router();

router.get(
  "/",
  authorizeRoles(
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "MANAGER"
  ),
  getAllSuppliers
);

router.get(
  "/:id",
  authorizeRoles(
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "MANAGER"
  ),
  getSupplierById
);

router.post(
  "/",
  authorizeRoles("ADMIN", "PURCHASING"),
  createSupplier
);

router.put(
  "/:id",
  authorizeRoles("ADMIN", "PURCHASING"),
  updateSupplier
);

router.patch(
  "/:id/status",
  authorizeRoles("ADMIN", "PURCHASING"),
  updateSupplierStatus
);

module.exports = router;