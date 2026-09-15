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
        message: "Username/email dan password wajib diisi.",
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
        password_changed_at,
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
        message: "Username/email atau password salah.",
      });
    }

    const user = result.rows[0];

    if (
      user.status !== "ACTIVE" ||
      !user.password_hash
    ) {
      return res.status(401).json({
        success: false,
        message: "Username/email atau password salah.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash,
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Username/email atau password salah.",
      });
    }

    const token = jwt.sign(
      {
        username: user.username,
        role: user.role,
        pwd: user.password_changed_at
          ? new Date(user.password_changed_at).toISOString()
          : null,
      },
      process.env.JWT_SECRET,
      {
        subject: user.id,
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      },
    );

    return res.status(200).json({
      success: true,
      message: "Login berhasil.",
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
      message: "Login gagal diproses.",
    });
  }
};

const forgotPassword = async (req, res) => {
  const genericResponse = {
    success: true,
    message:
      "Jika email terdaftar, instruksi reset password akan dikirim.",
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
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(200).json(genericResponse);
  }
};

const validatePasswordResetToken = async (req, res) => {
  try {
    const tokenRecord = await findValidAuthToken({
      token: req.query?.token,
      tokenType: TOKEN_TYPES.PASSWORD_RESET,
    });

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        message: "Tautan reset password tidak valid atau sudah kedaluwarsa.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Tautan reset password valid.",
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
      message: "Tautan reset password gagal divalidasi.",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password, password_confirmation } = req.body ?? {};

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token reset password wajib tersedia.",
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password harus minimal 8 karakter.",
      });
    }

    if (password !== password_confirmation) {
      return res.status(400).json({
        success: false,
        message: "Konfirmasi password tidak sesuai.",
      });
    }

    const tokenRecord = await findValidAuthToken({
      token,
      tokenType: TOKEN_TYPES.PASSWORD_RESET,
    });

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        message: "Tautan reset password tidak valid atau sudah kedaluwarsa.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const consumed = await consumeAuthToken({
      tokenId: tokenRecord.id,
      userId: tokenRecord.user_id,
      passwordHash,
      verifyEmail: false,
    });

    if (!consumed) {
      return res.status(400).json({
        success: false,
        message: "Tautan reset password tidak valid atau sudah kedaluwarsa.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password berhasil diatur ulang.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Reset password gagal diproses.",
    });
  }
};

const validateActivationToken = async (req, res) => {
  try {
    const tokenRecord = await findValidAuthToken({
      token: req.query?.token,
      tokenType: TOKEN_TYPES.ACCOUNT_ACTIVATION,
    });

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        message: "Tautan aktivasi tidak valid atau sudah kedaluwarsa.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Tautan aktivasi valid.",
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
      message: "Tautan aktivasi gagal divalidasi.",
    });
  }
};

const activateAccount = async (req, res) => {
  try {
    const { token, password, password_confirmation } = req.body ?? {};

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token aktivasi wajib tersedia.",
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password harus minimal 8 karakter.",
      });
    }

    if (password !== password_confirmation) {
      return res.status(400).json({
        success: false,
        message: "Konfirmasi password tidak sesuai.",
      });
    }

    const tokenRecord = await findValidAuthToken({
      token,
      tokenType: TOKEN_TYPES.ACCOUNT_ACTIVATION,
    });

    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        message: "Tautan aktivasi tidak valid atau sudah kedaluwarsa.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const consumed = await consumeAuthToken({
      tokenId: tokenRecord.id,
      userId: tokenRecord.user_id,
      passwordHash,
      verifyEmail: true,
    });

    if (!consumed) {
      return res.status(400).json({
        success: false,
        message: "Tautan aktivasi tidak valid atau sudah kedaluwarsa.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Akun berhasil diaktifkan. Silakan login.",
    });
  } catch (error) {
    console.error("Activate account error:", error);
    return res.status(500).json({
      success: false,
      message: "Aktivasi akun gagal diproses.",
    });
  }
};

const getCurrentUser = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Data pengguna berhasil dimuat.",
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
