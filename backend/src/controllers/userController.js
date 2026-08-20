const pool = require("../config/database");

const bcrypt = require("bcryptjs");

const USER_ROLES = [
  "ADMIN",
  "PURCHASING",
  "WAREHOUSE",
  "SALES",
  "FINANCE",
  "MANAGER",
];

const USER_STATUSES = [
  "ACTIVE",
  "INACTIVE",
];

const getAllUsers = async (req, res) => {
  try {
    const {
      search = "",
      role,
      status,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(
      Math.max(Number(limit) || 10, 1),
      100
    );
    const offset = (pageNumber - 1) * limitNumber;

    if (role && !USER_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role",
      });
    }

    if (status && !USER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user status",
      });
    }

    const conditions = [];
    const values = [];

    if (search.trim()) {
      values.push(`%${search.trim()}%`);

      conditions.push(`
        (
          u.username ILIKE $${values.length}
          OR u.full_name ILIKE $${values.length}
          OR COALESCE(u.email, '')
            ILIKE $${values.length}
        )
      `);
    }

    if (role) {
      values.push(role);
      conditions.push(
        `u.role::TEXT = $${values.length}`
      );
    }

    if (status) {
      values.push(status);
      conditions.push(
        `u.status::TEXT = $${values.length}`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::INTEGER AS total
      FROM app.users u
      ${whereClause}
      `,
      values
    );

    const queryValues = [
      ...values,
      limitNumber,
      offset,
    ];

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.role,
        u.status,
        u.created_at,
        u.updated_at

      FROM app.users u

      ${whereClause}

      ORDER BY u.created_at DESC

      LIMIT $${queryValues.length - 1}
      OFFSET $${queryValues.length}
      `,
      queryValues
    );

    const totalData = countResult.rows[0].total;

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: result.rows,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total_data: totalData,
        total_pages: Math.ceil(
          totalData / limitNumber
        ),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve users",
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        id,
        username,
        full_name,
        email,
        role,
        status,
        created_at,
        updated_at

      FROM app.users

      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching user:", error);

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve user",
    });
  }
};

const createUser = async (req, res) => {
  try {
    const {
      username,
      full_name,
      email,
      password,
      role,
      status = "ACTIVE",
    } = req.body;

    if (
      !username?.trim() ||
      !full_name?.trim() ||
      !password ||
      !role
    ) {
      return res.status(400).json({
        success: false,
        message:
          "username, full_name, password, and role are required",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least 8 characters",
      });
    }

    const normalizedRole = String(role).toUpperCase();
    const normalizedStatus =
      String(status).toUpperCase();

    if (!USER_ROLES.includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role",
      });
    }

    if (!USER_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user status",
      });
    }

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    const result = await pool.query(
      `
      INSERT INTO app.users (
        username,
        full_name,
        email,
        password_hash,
        role,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6)

      RETURNING
        id,
        username,
        full_name,
        email,
        role,
        status,
        created_at,
        updated_at
      `,
      [
        username.trim().toLowerCase(),
        full_name.trim(),
        email?.trim().toLowerCase() || null,
        passwordHash,
        normalizedRole,
        normalizedStatus,
      ]
    );

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating user:", error);

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

    res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      full_name,
      email,
      role,
      status,
    } = req.body;

    if (
      full_name === undefined &&
      email === undefined &&
      role === undefined &&
      status === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "No user data provided for update",
      });
    }

    if (
      full_name !== undefined &&
      (
        typeof full_name !== "string" ||
        !full_name.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "full_name cannot be empty",
      });
    }

    const normalizedRole =
      role === undefined
        ? null
        : String(role).toUpperCase();

    const normalizedStatus =
      status === undefined
        ? null
        : String(status).toUpperCase();

    const normalizedEmail =
      email === undefined
        ? null
        : email === null
          ? ""
          : String(email).trim().toLowerCase();

    if (
      normalizedRole &&
      !USER_ROLES.includes(normalizedRole)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role",
      });
    }

    if (
      normalizedStatus &&
      !USER_STATUSES.includes(normalizedStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user status",
      });
    }

    if (
      normalizedEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        normalizedEmail
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    if (
      id === req.user.id &&
      normalizedStatus === "INACTIVE"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot deactivate your own account",
      });
    }

    if (
      id === req.user.id &&
      normalizedRole &&
      normalizedRole !== req.user.role
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot change your own role",
      });
    }

    const result = await pool.query(
      `
      UPDATE app.users
      SET
        full_name = COALESCE(
          $1::VARCHAR,
          full_name
        ),

        email = CASE
          WHEN $2::TEXT IS NULL THEN email
          ELSE NULLIF(BTRIM($2::TEXT), '')
        END,

        role = COALESCE(
          $3::app.user_role,
          role
        ),

        status = COALESCE(
          $4::app.record_status,
          status
        ),

        updated_at = NOW()

      WHERE id = $5

      RETURNING
        id,
        username,
        full_name,
        email,
        role,
        status,
        created_at,
        updated_at
      `,
      [
        full_name === undefined
          ? null
          : full_name.trim(),
        normalizedEmail,
        normalizedRole,
        normalizedStatus,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating user:", error);

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    if (
      error.code === "23505" &&
      error.constraint === "users_email_key"
    ) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least 8 characters",
      });
    }

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    const result = await pool.query(
      `
      UPDATE app.users
      SET
        password_hash = $1,
        updated_at = NOW()

      WHERE id = $2

      RETURNING
        id,
        username,
        full_name,
        email,
        role,
        status,
        updated_at
      `,
      [passwordHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User password reset successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Error resetting user password:",
      error
    );

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to reset user password",
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  resetUserPassword,
};