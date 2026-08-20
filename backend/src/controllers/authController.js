const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Username/email and password are required",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error(
        "JWT_SECRET is not configured"
      );
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
        status
      FROM app.users
      WHERE
        LOWER(username) = LOWER($1)
        OR LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [identifier]
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
      !user.password_hash
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
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
        expiresIn:
          process.env.JWT_EXPIRES_IN || "8h",
      }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        access_token: token,
        token_type: "Bearer",
        expires_in:
          process.env.JWT_EXPIRES_IN || "8h",
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to login",
    });
  }
};

const getCurrentUser = async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Current user retrieved successfully",
    data: req.user,
  });
};

module.exports = {
  login,
  getCurrentUser,
};