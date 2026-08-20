const express = require("express");

const authorizeRoles = require(
  "../middleware/authorizeRoles"
);

const {
  getAllInventoryMovements,
  getInventoryMovementById,
} = require(
  "../controllers/inventoryMovementController"
);

const router = express.Router();

router.get(
  "/",
  authorizeRoles(
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER"
  ),
  getAllInventoryMovements
);

router.get(
  "/:id",
  authorizeRoles(
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER"
  ),
  getInventoryMovementById
);

module.exports = router;