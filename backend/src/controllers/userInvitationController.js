const pool = require("../config/database");
const {
  TOKEN_TYPES,
  createAuthToken,
} = require("../services/authTokenService");
const {
  sendAccountActivationEmail,
} = require("../services/emailService");

const USER_ROLES = [
  "ADMIN",
  "PURCHASING",
  "WAREHOUSE",
  "SALES",
  "FINANCE",
  "MANAGER",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const inviteUser = async (req, res) => {
  try {
    const {
      username,
      full_name,
      email,
      role,
    } = req.body || {};

    const normalizedUsername =
      typeof username === "string"
        ? username.trim().toLowerCase()
        : "";
    const normalizedFullName =
      typeof full_name === "string"
        ? full_name.trim()
        : "";
    const normalizedEmail =
      typeof email === "string"
        ? email.trim().toLowerCase()
        : "";
    const normalizedRole =
      typeof role === "string"
        ? role.trim().toUpperCase()
        : "";

    if (
      !normalizedUsername ||
      !normalizedFullName ||
      !normalizedEmail ||
      !normalizedRole
    ) {
      return res.status(400).json({
        success: false,
        message:
          "username, full_name, email, and role are required",
      });
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    if (!USER_ROLES.includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO app.users (
        username,
        full_name,
        email,
        password_hash,
        role,
        status,
        email_verified_at,
        invited_at
      )
      VALUES (
        $1,
        $2,
        $3,
        NULL,
        $4,
        'INACTIVE',
        NULL,
        NOW()
      )
      RETURNING
        id,
        username,
        full_name,
        email,
        role,
        status,
        invited_at,
        created_at,
        updated_at
      `,
      [
        normalizedUsername,
        normalizedFullName,
        normalizedEmail,
        normalizedRole,
      ],
    );

    const user = result.rows[0];

    try {
      const { token, expiresAt } = await createAuthToken({
        userId: user.id,
        tokenType: TOKEN_TYPES.ACCOUNT_ACTIVATION,
        createdBy: req.user.id,
      });

      await sendAccountActivationEmail({
        email: user.email,
        fullName: user.full_name,
        token,
        expiresAt,
      });
    } catch (emailError) {
      await pool.query(
        "DELETE FROM app.users WHERE id = $1 AND password_hash IS NULL",
        [user.id],
      );
      throw emailError;
    }

    return res.status(201).json({
      success: true,
      message: "User invitation sent successfully",
      data: user,
    });
  } catch (error) {
    if (error.code === "23505") {
      if (error.constraint === "users_username_key") {
        return res.status(409).json({
          success: false,
          message: "Username already exists",
        });
      }

      if (error.constraint === "users_email_key") {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    console.error("Error inviting user:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to invite user",
    });
  }
};

const resendInvitation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!UUID_PATTERN.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        username,
        full_name,
        email,
        status,
        password_hash,
        email_verified_at
      FROM app.users
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.password_hash || user.email_verified_at) {
      return res.status(400).json({
        success: false,
        message: "User account is already activated",
      });
    }

    if (!user.email) {
      return res.status(400).json({
        success: false,
        message: "User does not have an email address",
      });
    }

    const { token, expiresAt } = await createAuthToken({
      userId: user.id,
      tokenType: TOKEN_TYPES.ACCOUNT_ACTIVATION,
      createdBy: req.user.id,
    });

    await pool.query(
      `
      UPDATE app.users
      SET invited_at = NOW(), updated_at = NOW()
      WHERE id = $1
      `,
      [user.id],
    );

    await sendAccountActivationEmail({
      email: user.email,
      fullName: user.full_name,
      token,
      expiresAt,
    });

    return res.status(200).json({
      success: true,
      message: "User invitation resent successfully",
    });
  } catch (error) {
    console.error("Error resending user invitation:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to resend user invitation",
    });
  }
};

module.exports = {
  inviteUser,
  resendInvitation,
};
