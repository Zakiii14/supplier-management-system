const pool = require("../config/database");

const normalizeCategoryCode = (value) =>
  typeof value === "string"
    ? value.trim().toUpperCase()
    : "";

const normalizeCategoryName = (value) =>
  typeof value === "string"
    ? value.trim()
    : "";

const getAllCategories = async (req, res) => {
  try {
    const {
      search = "",
      status,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(limitNumber) ||
      limitNumber < 1 ||
      limitNumber > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    if (
      status &&
      !["ACTIVE", "INACTIVE"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Status must be ACTIVE or INACTIVE",
      });
    }

    const conditions = [];
    const values = [];

    if (search.trim()) {
      values.push(`%${search.trim()}%`);

      conditions.push(`
        (
          category_code ILIKE $${values.length}
          OR category_name ILIKE $${values.length}
        )
      `);
    }

    if (status) {
      values.push(status);

      conditions.push(
        `status = $${values.length}`,
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::INTEGER AS total
      FROM app.categories
      ${whereClause}
      `,
      values,
    );

    const total = countResult.rows[0].total;
    const offset =
      (pageNumber - 1) * limitNumber;

    const dataValues = [...values];

    dataValues.push(limitNumber);
    const limitParam = dataValues.length;

    dataValues.push(offset);
    const offsetParam = dataValues.length;

    const result = await pool.query(
      `
      SELECT
        id,
        category_code,
        category_name,
        status,
        created_at
      FROM app.categories
      ${whereClause}
      ORDER BY category_name ASC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
      `,
      dataValues,
    );

    res.status(200).json({
      success: true,
      message: "Categories retrieved successfully",
      data: result.rows,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        total_pages: Math.ceil(
          total / limitNumber,
        ),
      },
    });
  } catch (error) {
    console.error("Error fetching categories:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve categories",
    });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        id,
        category_code,
        category_name,
        status,
        created_at
      FROM app.categories
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Category retrieved successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching category:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve category",
    });
  }
};

const createCategory = async (req, res) => {
  try {
    const { category_code, category_name } = req.body;
    const normalizedCategoryCode =
      normalizeCategoryCode(category_code);
    const normalizedCategoryName =
      normalizeCategoryName(category_name);

    if (!normalizedCategoryCode || !normalizedCategoryName) {
      return res.status(400).json({
        success: false,
        message: "category_code and category_name are required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO app.categories (
        category_code,
        category_name
      )
      VALUES ($1, $2)
      RETURNING *
      `,
      [
        normalizedCategoryCode,
        normalizedCategoryName,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Category code or name already exists",
      });
    }

    console.error("Error creating category:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create category",
    });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_code, category_name } = req.body;
    const normalizedCategoryCode =
      normalizeCategoryCode(category_code);

    const normalizedCategoryName =
      normalizeCategoryName(category_name);

    if (
      !normalizedCategoryCode ||
      !normalizedCategoryName
    ) {
      return res.status(400).json({
        success: false,
        message: "category_code and category_name are required",
      });
    }

    const result = await pool.query(
      `
      UPDATE app.categories
      SET
        category_code = $1,
        category_name = $2
      WHERE id = $3
      RETURNING *
      `,
      [
        normalizedCategoryCode,
        normalizedCategoryName,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Category code or name already exists",
      });
    }

    console.error("Error updating category:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update category",
    });
  }
};

const updateCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be ACTIVE or INACTIVE",
      });
    }

    const result = await pool.query(
      `
      UPDATE app.categories
      SET status = $1
      WHERE id = $2
      RETURNING *
      `,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Category status updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating category status:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update category status",
    });
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  updateCategoryStatus,
};