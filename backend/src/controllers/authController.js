const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const pool = require("../config/database");
const {
  TOKEN_TYPES,
  createAuthToken,
  findValidAuthToken,
  consumeAuthToken,
} = require("../services/authTokenService");
const {
  sendPasswordResetEmail,
} = require("../services/emailService");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidPassword = (password) =>
  typeof password === "string" && password.length >= 8;

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Username/email and password are required",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    const result = await pool.query(
      `
      SELECT
        id,
        username,
        full_name,
        email,
        password_hash,
        role,
        status,
        email_verified_at,
        (avatar_storage_name IS NOT NULL) AS has_avatar,
        avatar_updated_at
      FROM app.users
      WHERE
        LOWER(username) = LOWER($1)
        OR LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [identifier],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const user = result.rows[0];

    if (
      user.status !== "ACTIVE" ||
      !user.password_hash ||
      (user.email && !user.email_verified_at)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash,
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        username: user.username,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        subject: user.id,
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      },
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        access_token: token,
        token_type: "Bearer",
        expires_in: process.env.JWT_EXPIRES_IN || "8h",
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          has_avatar: user.has_avatar,
          avatar_updated_at: user.avatar_updated_at,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to login",
    });
  }
};

const forgotPassword = async (req, res) => {
  const genericResponse = {
    success: true,
    message:
      "If the email is registered, password reset instructions will be sent.",
  };

  try {
    const normalizedEmail =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(200).json(genericResponse);
    }

    const result = await pool.query(
      `
      SELECT id, full_name, email, status, password_hash
      FROM app.users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [normalizedEmail],
    );

    const user = result.rows[0];

    if (!user || user.status !== "ACTIVE" || !user.password_hash) {
      return res.status(200).json(genericResponse);
    }

    const { token, expiresAt } = await createAuthToken({
      userId: user.id,
      tokenType: TOKEN_TYPES.PASSWORD_RESET,
    });

    await sendPasswordResetEmail({
      email: user.email,
      fullName: user.full_name,
      token,
      expiresAt,
    });

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(200).json(genericResponse);
  }
};

const validatePasswordResetToken = async (req, res) => {
  try {
    const token =
      typeof req.query?.token === "string"
        ? req.query.token.trim()
        : "";

    const authToken = await findValidAuthToken({
      token,
      tokenType: TOKEN_TYPES.PASSWORD_RESET,
    });

    if (!authToken) {
      return res.status(400).json({
        success: false,
        message: "Reset password link is invalid or expired",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Reset password link is valid",
      data: {
        email: authToken.email,
        expires_at: authToken.expires_at,
      },
    });
  } catch (error) {
    console.error("Validate password reset token error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to validate reset password link",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password, password_confirmation } = req.body || {};

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters",
      });
    }

    if (
      password_confirmation !== undefined &&
      password !== password_confirmation
    ) {
      return res.status(400).json({
        success: false,
        message: "Password confirmation does not match",
      });
    }

    const authToken = await findValidAuthToken({
      token,
      tokenType: TOKEN_TYPES.PASSWORD_RESET,
    });

    if (!authToken) {
      return res.status(400).json({
        success: false,
        message: "Reset password link is invalid or expired",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const consumed = await consumeAuthToken({
      tokenId: authToken.id,
      userId: authToken.user_id,
      passwordHash,
    });

    if (!consumed) {
      return res.status(400).json({
        success: false,
        message: "Reset password link is invalid or expired",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};

const validateActivationToken = async (req, res) => {
  try {
    const token =
      typeof req.query?.token === "string"
        ? req.query.token.trim()
        : "";

    const authToken = await findValidAuthToken({
      token,
      tokenType: TOKEN_TYPES.ACCOUNT_ACTIVATION,
    });

    if (!authToken) {
      return res.status(400).json({
        success: false,
        message: "Activation link is invalid or expired",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Activation link is valid",
      data: {
        username: authToken.username,
        full_name: authToken.full_name,
        email: authToken.email,
        expires_at: authToken.expires_at,
      },
    });
  } catch (error) {
    console.error("Validate activation token error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to validate activation link",
    });
  }
};

const activateAccount = async (req, res) => {
  try {
    const { token, password, password_confirmation } = req.body || {};

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Activation token is required",
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters",
      });
    }

    if (
      password_confirmation !== undefined &&
      password !== password_confirmation
    ) {
      return res.status(400).json({
        success: false,
        message: "Password confirmation does not match",
      });
    }

    const authToken = await findValidAuthToken({
      token,
      tokenType: TOKEN_TYPES.ACCOUNT_ACTIVATION,
    });

    if (!authToken) {
      return res.status(400).json({
        success: false,
        message: "Activation link is invalid or expired",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const consumed = await consumeAuthToken({
      tokenId: authToken.id,
      userId: authToken.user_id,
      passwordHash,
      verifyEmail: true,
    });

    if (!consumed) {
      return res.status(400).json({
        success: false,
        message: "Activation link is invalid or expired",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Account activated successfully",
    });
  } catch (error) {
    console.error("Activate account error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to activate account",
    });
  }
};

const getCurrentUser = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Current user retrieved successfully",
    data: req.user,
  });
};

module.exports = {
  login,
  forgotPassword,
  validatePasswordResetToken,
  resetPassword,
  validateActivationToken,
  activateAccount,
  getCurrentUser,
};
