const router = require("express").Router();
const { getNotifications, markNotificationsRead } = require("../controllers/notificationController");
router.get("/", getNotifications);
router.post("/read", markNotificationsRead);
module.exports = router;
