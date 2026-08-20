const express = require("express");

const authorizeRoles = require(
  "../middleware/authorizeRoles"
);

const {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  updateCategoryStatus,
} = require("../controllers/categoryController");

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
  getAllCategories
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
  getCategoryById
);

router.post(
  "/",
  authorizeRoles("ADMIN", "PURCHASING"),
  createCategory
);

router.put(
  "/:id",
  authorizeRoles("ADMIN", "PURCHASING"),
  updateCategory
);

router.patch(
  "/:id/status",
  authorizeRoles("ADMIN", "PURCHASING"),
  updateCategoryStatus
);

module.exports = router;