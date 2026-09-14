const express = require("express");
const authorizeRoles = require("../middleware/authorizeRoles");
const controller = require("../controllers/salesReturnController");

const router = express.Router();
const VIEW_ROLES = ["ADMIN", "SALES", "WAREHOUSE", "FINANCE", "MANAGER"];
const CREATE_ROLES = ["ADMIN", "SALES", "WAREHOUSE"];

router.get("/", authorizeRoles(...VIEW_ROLES), controller.getAllSalesReturns);
router.get("/deliveries", authorizeRoles(...CREATE_ROLES), controller.getReturnableDeliveries);
router.get("/deliveries/:id/items", authorizeRoles(...CREATE_ROLES), controller.getReturnableDeliveryItems);
router.get("/:id/settlement-invoices", authorizeRoles(...VIEW_ROLES), controller.getSettlementInvoices);
router.get("/:id", authorizeRoles(...VIEW_ROLES), controller.getSalesReturnById);
router.post("/", authorizeRoles(...CREATE_ROLES), controller.createSalesReturn);
router.post("/:id/submit", authorizeRoles(...CREATE_ROLES), controller.submitSalesReturn);
router.post("/:id/decision", authorizeRoles("ADMIN", "MANAGER"), controller.decideSalesReturn);
router.patch("/:id/cancel", authorizeRoles(...CREATE_ROLES), controller.cancelSalesReturn);
router.post("/:id/settlements", authorizeRoles("ADMIN", "FINANCE"), controller.createSalesReturnSettlement);

module.exports = router;
