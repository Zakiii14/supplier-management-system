const express = require("express");

const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  resetUserPassword,
} = require("../controllers/userController");
const {
  inviteUser,
  resendInvitation,
} = require("../controllers/userInvitationController");
const {
  getUserAvatar,
  replaceUserAvatar,
  deleteUserAvatar,
} = require("../controllers/userAvatarController");
const {
  uploadUserAvatar,
} = require("../services/userAvatarService");

const authorizeRoles = require(
  "../middleware/authorizeRoles"
);
const {
  blockDemoMutation,
} = require("../middleware/demoModeMiddleware");

const router = express.Router();

router.get(
  "/",
  authorizeRoles("ADMIN"),
  getAllUsers,
);

router.post(
  "/",
  authorizeRoles("ADMIN"),
  blockDemoMutation,
  createUser,
);

router.post(
  "/invite",
  authorizeRoles("ADMIN"),
  blockDemoMutation,
  inviteUser,
);

router.post(
  "/:id/resend-invitation",
  authorizeRoles("ADMIN"),
  blockDemoMutation,
  resendInvitation,
);

router.get("/:id/avatar", getUserAvatar);
router.put(
  "/:id/avatar",
  uploadUserAvatar,
  replaceUserAvatar,
);
router.delete(
  "/:id/avatar",
  deleteUserAvatar,
);

router.get(
  "/:id",
  authorizeRoles("ADMIN"),
  getUserById,
);

router.patch(
  "/:id",
  authorizeRoles("ADMIN"),
  blockDemoMutation,
  updateUser,
);

router.patch(
  "/:id/password",
  authorizeRoles("ADMIN"),
  blockDemoMutation,
  resetUserPassword,
);

module.exports = router;
