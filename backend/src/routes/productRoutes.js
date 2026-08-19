const express = require("express");

const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  updateProductStatus,
} = require("../controllers/productController");

const router = express.Router();

router.get("/", getAllProducts);
router.post("/", createProduct);

router.get("/:id", getProductById);
router.put("/:id", updateProduct);
router.patch("/:id/status", updateProductStatus);

module.exports = router;