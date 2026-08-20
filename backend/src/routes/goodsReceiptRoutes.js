const express = require("express");

const authorizeRoles = require(
  "../middleware/authorizeRoles"
);

const {
  getAllGoodsReceipts,
  getGoodsReceiptById,
  createGoodsReceipt,
} = require("../controllers/goodsReceiptController");

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
  getAllGoodsReceipts
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
  getGoodsReceiptById
);

router.post(
  "/",
  authorizeRoles("ADMIN", "WAREHOUSE"),
  createGoodsReceipt
);

module.exports = router;