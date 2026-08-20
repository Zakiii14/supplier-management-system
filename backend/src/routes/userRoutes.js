const express = require("express");

const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  resetUserPassword,
} = require("../controllers/userController");

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