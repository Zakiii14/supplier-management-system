const express = require("express");

const {
  getAllInventoryMovements,
  getInventoryMovementById,
} = require(
  "../controllers/inventoryMovementController"
);

const router = express.Router();

router.get("/", getAllInventoryMovements);
router.get("/:id", getInventoryMovementById);

module.exports = router;