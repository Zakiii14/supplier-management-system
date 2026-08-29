const bcrypt = require("bcryptjs");

const pool = require("../config/database");

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getAllUsers = async (req, res) => {
  try {
    const {
      search = "",
      role = "",
      status = "",
      page = "1",
      limit = "10",
    } = req.query;

    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

    if (
      !Number.isInteger(parsedPage) ||
      !Number.isInteger(parsedLimit) ||
      parsedPage < 1 ||
      parsedLimit < 1 ||
      parsedLimit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    const normalizedSearch =
      typeof search === "string"
        ? search.trim()
        : "";

    const normalizedRole =
      typeof role === "string"
        ? role.trim().toUpperCase()
        : "";

    const normalizedStatus =
      typeof status === "string"
        ? status.trim().toUpperCase()
        : "";

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

    const conditions = [];
    const values = [];

    if (normalizedSearch) {
      values.push(`%${normalizedSearch}%`);

      conditions.push(`
        (
          u.username ILIKE $${values.length}
          OR u.full_name ILIKE $${values.length}
          OR COALESCE(u.email, '')
            ILIKE $${values.length}
        )
      `);
    }

    if (normalizedRole) {
      values.push(normalizedRole);
      conditions.push(
        `u.role::TEXT = $${values.length}`,
      );
    }

    if (normalizedStatus) {
      values.push(normalizedStatus);
      conditions.push(
        `u.status::TEXT = $${values.length}`,
      );
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::INTEGER AS total
      FROM app.users u
      ${whereClause}
      `,
      values,
    );

    const total = countResult.rows[0].total;
    const totalPages =
      total === 0
        ? 0
        : Math.ceil(total / parsedLimit);
    const offset =
      (parsedPage - 1) * parsedLimit;

    const listValues = [
      ...values,
      parsedLimit,
      offset,
    ];

    const limitPosition = values.length + 1;
    const offsetPosition = values.length + 2;

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
      ORDER BY
        u.created_at DESC,
        u.username ASC
      LIMIT $${limitPosition}
      OFFSET $${offsetPosition}
      `,
      listValues,
    );

    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: result.rows,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve users",
    });
  }
};

const getUserById = async (req, res) => {
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
        role,
        status,
        created_at,
        updated_at
      FROM app.users
      WHERE id = $1
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching user:", error);

    return res.status(500).json({
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

    const normalizedStatus =
      typeof status === "string"
        ? status.trim().toUpperCase()
        : "";

    if (
      !normalizedUsername ||
      !normalizedFullName ||
      typeof password !== "string" ||
      !password ||
      !normalizedRole
    ) {
      return res.status(400).json({
        success: false,
        message:
          "username, full_name, password, and role are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least 8 characters",
      });
    }

    if (
      normalizedEmail &&
      !EMAIL_PATTERN.test(normalizedEmail)
    ) {
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

    if (!USER_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user status",
      });
    }

    const passwordHash = await bcrypt.hash(
      password,
      12,
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
        normalizedUsername,
        normalizedFullName,
        normalizedEmail || null,
        passwordHash,
        normalizedRole,
        normalizedStatus,
      ],
    );

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: result.rows[0],
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

    console.error("Error creating user:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!UUID_PATTERN.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

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

    const normalizedFullName =
      full_name === undefined
        ? null
        : typeof full_name === "string"
          ? full_name.trim()
          : "";

    const normalizedEmail =
      email === undefined
        ? null
        : email === null
          ? ""
          : typeof email === "string"
            ? email.trim().toLowerCase()
            : "";

    const normalizedRole =
      role === undefined
        ? null
        : typeof role === "string"
          ? role.trim().toUpperCase()
          : "";

    const normalizedStatus =
      status === undefined
        ? null
        : typeof status === "string"
          ? status.trim().toUpperCase()
          : "";

    if (
      full_name !== undefined &&
      !normalizedFullName
    ) {
      return res.status(400).json({
        success: false,
        message: "full_name cannot be empty",
      });
    }

    if (
      normalizedEmail &&
      !EMAIL_PATTERN.test(normalizedEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    if (
      role !== undefined &&
      !USER_ROLES.includes(normalizedRole)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user role",
      });
    }

    if (
      status !== undefined &&
      !USER_STATUSES.includes(normalizedStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user status",
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
        normalizedFullName,
        normalizedEmail,
        normalizedRole,
        normalizedStatus,
        id,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    if (
      error.code === "23505" &&
      error.constraint === "users_email_key"
    ) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    console.error("Error updating user:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!UUID_PATTERN.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
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

    const passwordHash = await bcrypt.hash(
      password,
      12,
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
      [passwordHash, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User password reset successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Error resetting user password:",
      error,
    );

    return res.status(500).json({
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
