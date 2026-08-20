const express = require("express");

const authorizeRoles = require(
  "../middleware/authorizeRoles"
);

const {
  getAllDeliveries,
  getDeliveryById,
  createDelivery,
  updateDeliveryStatus
} = require("../controllers/deliveryController");

const router = express.Router();

router.get(
  "/",
  authorizeRoles(
    "ADMIN",
    "SALES",
    "WAREHOUSE",
    "MANAGER"
  ),
  getAllDeliveries
);

router.get(
  "/:id",
  authorizeRoles(
    "ADMIN",
    "SALES",
    "WAREHOUSE",
    "MANAGER"
  ),
  getDeliveryById
);

router.post(
  "/",
  authorizeRoles("ADMIN", "WAREHOUSE"),
  createDelivery
);

router.patch(
  "/:id/status",
  authorizeRoles("ADMIN", "WAREHOUSE"),
  updateDeliveryStatus
);

module.exports = router;