const pool = require("../config/database");

const getAllCategories = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        category_code,
        category_name,
        status,
        created_at
      FROM app.categories
      ORDER BY category_name ASC
    `);

    res.status(200).json({
      success: true,
      message: "Categories retrieved successfully",
      data: result.rows,
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

    if (!category_code || !category_name) {
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
      [category_code, category_name]
    );

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating category:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Category code or name already exists",
      });
    }

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

    if (!category_code || !category_name) {
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
      [category_code, category_name, id]
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
    console.error("Error updating category:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Category code or name already exists",
      });
    }

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