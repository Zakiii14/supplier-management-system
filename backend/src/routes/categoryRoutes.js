const express = require("express");

const {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  updateCategoryStatus,
} = require("../controllers/categoryController");

const router = express.Router();

router.get("/", getAllCategories);
router.post("/", createCategory);

router.get("/:id", getCategoryById);
router.put("/:id", updateCategory);
router.patch("/:id/status", updateCategoryStatus);

module.exports = router;