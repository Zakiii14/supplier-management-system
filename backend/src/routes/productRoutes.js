const express = require("express");

const authorizeRoles = require(
  "../middleware/authorizeRoles"
);

const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  updateProductStatus,
} = require("../controllers/productController");

const router = express.Router();

router.get(
  "/",
  authorizeRoles(
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "SALES",
    "FINANCE",
    "MANAGER"
  ),
  getAllProducts
);

router.get(
  "/:id",
  authorizeRoles(
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "SALES",
    "FINANCE",
    "MANAGER"
  ),
  getProductById
);

router.post(
  "/",
  authorizeRoles("ADMIN", "PURCHASING"),
  createProduct
);

router.put(
  "/:id",
  authorizeRoles("ADMIN", "PURCHASING"),
  updateProduct
);

router.patch(
  "/:id/status",
  authorizeRoles("ADMIN", "PURCHASING"),
  updateProductStatus
);

module.exports = router;