const express = require("express");
const authorizeRoles = require("../middleware/authorizeRoles");
const { getTaxSettings, updateTaxSettings } = require("../controllers/taxSettingController");

const router = express.Router();

router.get("/", authorizeRoles("ADMIN", "FINANCE", "SALES", "MANAGER"), getTaxSettings);
router.put("/", authorizeRoles("ADMIN"), updateTaxSettings);

module.exports = router;
