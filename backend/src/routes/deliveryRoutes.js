const express = require("express");

const {
  getAllDeliveries,
  getDeliveryById,
  createDelivery,
  updateDeliveryStatus
} = require("../controllers/deliveryController");

const router = express.Router();

router.get("/", getAllDeliveries);
router.get("/:id", getDeliveryById);
router.post("/", createDelivery);
router.patch("/:id/status", updateDeliveryStatus);

module.exports = router;