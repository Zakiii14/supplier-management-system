const router=require("express").Router();
const authorize=require("../middleware/authorizeRoles");
const {getAuditLogs,getAuditLog}=require("../controllers/auditLogController");
router.get("/",authorize("ADMIN","MANAGER"),getAuditLogs);
router.get("/:id",authorize("ADMIN","MANAGER"),getAuditLog);
module.exports=router;
