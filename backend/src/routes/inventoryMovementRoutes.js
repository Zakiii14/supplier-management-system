const express = require("express");

const authorizeRoles = require(
  "../middleware/authorizeRoles"
);

const {
  getAllInventoryMovements,
  getInventoryMovementById,
  getQuarantineStocks,
  createStockInspection,
  getDamagedStocks,
  createDamageResolution,
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
  "/quarantine-stocks",
  authorizeRoles("ADMIN", "WAREHOUSE", "MANAGER"),
  getQuarantineStocks
);

router.post(
  "/stock-inspections",
  authorizeRoles("ADMIN", "WAREHOUSE", "MANAGER"),
  createStockInspection
);

router.get(
  "/damaged-stocks",
  authorizeRoles("ADMIN", "WAREHOUSE", "MANAGER"),
  getDamagedStocks
);

router.post(
  "/damage-resolutions",
  authorizeRoles("ADMIN", "WAREHOUSE", "MANAGER"),
  createDamageResolution
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
