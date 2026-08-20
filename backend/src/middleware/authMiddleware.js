const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const authenticate = async (req, res, next) => {
  try {
    const authorization =
      req.headers.authorization;

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const result = await pool.query(
      `
      SELECT
        id,
        username,
        full_name,
        email,
        role,
        status
      FROM app.users
      WHERE id = $1
        AND status = 'ACTIVE'
      `,
      [payload.sub]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message:
          "User is not available or inactive",
      });
    }

    req.user = result.rows[0];

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Authentication token has expired",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid authentication token",
    });
  }
};

module.exports = authenticate;