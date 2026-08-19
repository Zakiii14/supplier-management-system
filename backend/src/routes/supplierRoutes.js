const express = require("express");
const {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  updateSupplierStatus,
} = require("../controllers/supplierController");

const router = express.Router();

router.get("/", getAllSuppliers);
router.get("/:id", getSupplierById);

router.post("/", createSupplier);
router.put("/:id", updateSupplier);
router.patch("/:id/status", updateSupplierStatus);
module.exports = router;