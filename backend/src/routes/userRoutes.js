const express = require("express");

const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  resetUserPassword,
} = require("../controllers/userController");
const { getUserAvatar, replaceUserAvatar, deleteUserAvatar } = require("../controllers/userAvatarController");
const { uploadUserAvatar } = require("../services/userAvatarService");

const authorizeRoles = require(
  "../middleware/authorizeRoles"
);

const router = express.Router();

router.get(
  "/",
  authorizeRoles("ADMIN"),
  getAllUsers
);

router.post(
  "/",
  authorizeRoles("ADMIN"),
  createUser
);

router.get("/:id/avatar", getUserAvatar);
router.put("/:id/avatar", authorizeRoles("ADMIN"), uploadUserAvatar, replaceUserAvatar);
router.delete("/:id/avatar", authorizeRoles("ADMIN"), deleteUserAvatar);

router.get(
  "/:id",
  authorizeRoles("ADMIN"),
  getUserById
);

router.patch(
  "/:id",
  authorizeRoles("ADMIN"),
  updateUser
);


router.patch(
  "/:id/password",
  authorizeRoles("ADMIN"),
  resetUserPassword
);

module.exports = router;
