const express = require("express");

const {
  getAllGoodsReceipts,
  getGoodsReceiptById,
  createGoodsReceipt,
} = require("../controllers/goodsReceiptController");

const router = express.Router();

router.get("/", getAllGoodsReceipts);
router.get("/:id", getGoodsReceiptById);
router.post("/", createGoodsReceipt);

module.exports = router;