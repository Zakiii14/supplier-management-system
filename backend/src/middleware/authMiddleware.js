const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const { isDemoMode, isActiveDemoSession } = require("../services/demoSessionService");

const authenticate = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message: "Token autentikasi wajib tersedia.",
      });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token autentikasi wajib tersedia.",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET,
    );

    const result = await pool.query(
      `
      SELECT
        id,
        username,
        full_name,
        email,
        role,
        status,
        password_changed_at,
        (avatar_storage_name IS NOT NULL) AS has_avatar,
        avatar_updated_at
      FROM app.users
      WHERE id = $1
        AND status = 'ACTIVE'
      `,
      [payload.sub],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Pengguna tidak tersedia atau akun tidak aktif.",
      });
    }

    const user = result.rows[0];

    if (user.password_changed_at) {
      const currentPasswordVersion = new Date(
        user.password_changed_at,
      ).toISOString();

      if (payload.pwd) {
        if (payload.pwd !== currentPasswordVersion) {
          return res.status(401).json({
            success: false,
            message: "Sesi login tidak lagi berlaku. Silakan login kembali.",
          });
        }
      } else if (payload.iat) {
        const passwordChangedAtSeconds = Math.floor(
          new Date(user.password_changed_at).getTime() / 1000,
        );

        if (payload.iat < passwordChangedAtSeconds) {
          return res.status(401).json({
            success: false,
            message: "Sesi login tidak lagi berlaku. Silakan login kembali.",
          });
        }
      }
    }

    if (isDemoMode()) {
      const session = { clientId: payload.demo_client_id, sessionId: payload.demo_session_id, userId: user.id };
      if (!(await isActiveDemoSession(session))) {
        return res.status(401).json({ success: false, message: "Sesi demo sudah berakhir. Silakan login kembali." });
      }
      req.demoSession = session;
    }

    delete user.password_changed_at;
    req.user = user;

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Sesi login sudah kedaluwarsa. Silakan login kembali.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Token autentikasi tidak valid.",
    });
  }
};

module.exports = authenticate;
