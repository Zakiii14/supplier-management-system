const express = require("express");
const authorizeRoles = require("../middleware/authorizeRoles");
const {
  getAllStockOpnames,
  getStockOpnameById,
  createStockOpname,
  submitStockOpname,
  decideStockOpname,
  cancelStockOpname,
} = require("../controllers/stockOpnameController");

const router = express.Router();

router.get("/", authorizeRoles("ADMIN", "WAREHOUSE", "MANAGER"), getAllStockOpnames);
router.get("/:id", authorizeRoles("ADMIN", "WAREHOUSE", "MANAGER"), getStockOpnameById);
router.post("/", authorizeRoles("ADMIN", "WAREHOUSE"), createStockOpname);
router.post("/:id/submit", authorizeRoles("ADMIN", "WAREHOUSE"), submitStockOpname);
router.post("/:id/decision", authorizeRoles("ADMIN", "MANAGER"), decideStockOpname);
router.patch("/:id/cancel", authorizeRoles("ADMIN", "WAREHOUSE"), cancelStockOpname);

module.exports = router;
