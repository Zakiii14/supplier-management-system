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

    // Invitation-created accounts stay INACTIVE and passwordless until their
    // activation token is consumed. Keeping login gated by status + password
    // preserves compatibility with legacy/internal accounts that predate email
    // verification while still preventing invited accounts from signing in
    // before activation.
    if (
      user.status !== "ACTIVE" ||
      !user.password_hash
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

    if (
      user &&
      user.status === "ACTIVE" &&
      user.password_hash
    ) {
      const { rawToken, expiresAt } = await createAuthToken({
        userId: user.id,
        type: TOKEN_TYPES.PASSWORD_RESET,
        ttlMinutes: Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 30,
      });

      await sendPasswordResetEmail({
        to: user.email,
        fullName: user.full_name,
        token: rawToken,
        expiresAt,
      });
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(200).json(genericResponse);
  }
};

const validatePasswordResetToken = async (req, res) => {
  try {
    const tokenRecord = await findValidAuthToken(
      req.query?.token,
      TOKEN_TYPES.PASSWORD_RESET,
    );

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        message: "Reset password link is invalid or has expired",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Reset password token is valid",
      data: {
        email: tokenRecord.email,
        full_name: tokenRecord.full_name,
        expires_at: tokenRecord.expires_at,
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
  const client = await pool.connect();

  try {
    const { token, password, password_confirmation } = req.body ?? {};

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

    if (password !== password_confirmation) {
      return res.status(400).json({
        success: false,
        message: "Password confirmation does not match",
      });
    }

    await client.query("BEGIN");

    const tokenRecord = await findValidAuthToken(
      token,
      TOKEN_TYPES.PASSWORD_RESET,
      client,
    );

    if (!tokenRecord) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Reset password link is invalid or has expired",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await client.query(
      `
      UPDATE app.users
      SET
        password_hash = $1,
        password_changed_at = NOW(),
        updated_at = NOW()
      WHERE id = $2
      `,
      [passwordHash, tokenRecord.user_id],
    );

    await consumeAuthToken(tokenRecord.id, client);

    await client.query(
      `
      UPDATE app.auth_tokens
      SET used_at = COALESCE(used_at, NOW())
      WHERE user_id = $1
        AND token_type = 'PASSWORD_RESET'
        AND used_at IS NULL
      `,
      [tokenRecord.user_id],
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  } finally {
    client.release();
  }
};

const validateActivationToken = async (req, res) => {
  try {
    const tokenRecord = await findValidAuthToken(
      req.query?.token,
      TOKEN_TYPES.ACCOUNT_ACTIVATION,
    );

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        message: "Activation link is invalid or has expired",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Activation token is valid",
      data: {
        username: tokenRecord.username,
        email: tokenRecord.email,
        full_name: tokenRecord.full_name,
        expires_at: tokenRecord.expires_at,
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
  const client = await pool.connect();

  try {
    const { token, password, password_confirmation } = req.body ?? {};

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

    if (password !== password_confirmation) {
      return res.status(400).json({
        success: false,
        message: "Password confirmation does not match",
      });
    }

    await client.query("BEGIN");

    const tokenRecord = await findValidAuthToken(
      token,
      TOKEN_TYPES.ACCOUNT_ACTIVATION,
      client,
    );

    if (!tokenRecord) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Activation link is invalid or has expired",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await client.query(
      `
      UPDATE app.users
      SET
        password_hash = $1,
        status = 'ACTIVE',
        email_verified_at = COALESCE(email_verified_at, NOW()),
        password_changed_at = NOW(),
        updated_at = NOW()
      WHERE id = $2
      `,
      [passwordHash, tokenRecord.user_id],
    );

    await consumeAuthToken(tokenRecord.id, client);

    await client.query(
      `
      UPDATE app.auth_tokens
      SET used_at = COALESCE(used_at, NOW())
      WHERE user_id = $1
        AND token_type = 'ACCOUNT_ACTIVATION'
        AND used_at IS NULL
      `,
      [tokenRecord.user_id],
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Account activated successfully. You can now log in.",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Activate account error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to activate account",
    });
  } finally {
    client.release();
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
