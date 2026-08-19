const express = require("express");
const {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
} = require("../controllers/supplierController");

const router = express.Router();

router.get("/", getAllSuppliers);
router.get("/:id", getSupplierById);

router.post("/", createSupplier);
module.exports = router;