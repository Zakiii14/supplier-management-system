const pool = require("../config/database");

const normalizeSku = (value) =>
  typeof value === "string"
    ? value.trim().toUpperCase()
    : "";

const getAllProducts = async (req, res) => {
  try {
    const {
      search = "",
      status,
      category_id,
      supplier_id,
      low_stock,
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

    if (status && !["ACTIVE", "INACTIVE"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be ACTIVE or INACTIVE",
      });
    }

    if (
      low_stock &&
      !["true", "false"].includes(low_stock)
    ) {
      return res.status(400).json({
        success: false,
        message: "low_stock must be true or false",
      });
    }

    const offset = (pageNumber - 1) * limitNumber;

    const conditions = [];
    const values = [];

    if (search) {
      values.push(`%${search}%`);

      conditions.push(`
        (
          p.sku ILIKE $${values.length}
          OR p.product_name ILIKE $${values.length}
          OR c.category_name ILIKE $${values.length}
          OR s.supplier_name ILIKE $${values.length}
        )
      `);
    }

    if (status) {
      values.push(status);

      conditions.push(
        `p.status = $${values.length}`
      );
    }

    if (category_id) {
      values.push(category_id);

      conditions.push(
        `p.category_id = $${values.length}`
      );
    }

    if (supplier_id) {
      values.push(supplier_id);

      conditions.push(
        `p.supplier_id = $${values.length}`
      );
    }

    if (low_stock === "true") {
      conditions.push(
        "p.current_stock <= p.minimum_stock"
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countQuery = `
      SELECT COUNT(*)::INTEGER AS total

      FROM app.products p

      JOIN app.categories c
        ON c.id = p.category_id

      JOIN app.suppliers s
        ON s.id = p.supplier_id

      ${whereClause}
    `;

    const countResult = await pool.query(
      countQuery,
      values
    );

    const total = countResult.rows[0].total;

    const dataValues = [...values];

    dataValues.push(limitNumber);
    const limitParam = dataValues.length;

    dataValues.push(offset);
    const offsetParam = dataValues.length;

    const dataQuery = `
      SELECT
        p.id,
        p.sku,
        p.product_name,
        p.unit,
        p.purchase_price,
        p.selling_price,
        p.minimum_stock,
        p.current_stock,
        p.status,
        p.description,
        p.created_at,
        p.updated_at,

        c.id AS category_id,
        c.category_code,
        c.category_name,

        s.id AS supplier_id,
        s.supplier_code,
        s.supplier_name,

        CASE
          WHEN p.current_stock <= p.minimum_stock
          THEN true
          ELSE false
        END AS is_low_stock

      FROM app.products p

      JOIN app.categories c
        ON c.id = p.category_id

      JOIN app.suppliers s
        ON s.id = p.supplier_id

      ${whereClause}

      ORDER BY p.product_name ASC

      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `;

    const result = await pool.query(
      dataQuery,
      dataValues
    );

    res.status(200).json({
      success: true,
      message: "Products retrieved successfully",
      data: result.rows,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        total_pages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve products",
    });
  }
};

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        p.id,
        p.sku,
        p.product_name,
        p.unit,
        p.purchase_price,
        p.selling_price,
        p.minimum_stock,
        p.current_stock,
        p.status,
        p.description,
        p.created_at,
        p.updated_at,

        c.id AS category_id,
        c.category_code,
        c.category_name,

        s.id AS supplier_id,
        s.supplier_code,
        s.supplier_name

      FROM app.products p

      JOIN app.categories c
        ON c.id = p.category_id

      JOIN app.suppliers s
        ON s.id = p.supplier_id

      WHERE p.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product retrieved successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching product:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve product",
    });
  }
};

const createProduct = async (req, res) => {
  try {
    const {
      sku,
      product_name,
      category_id,
      supplier_id,
      unit,
      purchase_price,
      selling_price,
      minimum_stock,
      description,
    } = req.body;

    const normalizedSku = normalizeSku(sku);

    if (
      !normalizedSku ||
      !product_name ||
      !category_id ||
      !supplier_id
    ) {
      return res.status(400).json({
        success: false,
        message:
          "sku, product_name, category_id, and supplier_id are required",
      });
    }

    // Cek category
    const categoryResult = await pool.query(
      `
      SELECT id
      FROM app.categories
      WHERE id = $1
      AND status = 'ACTIVE'
      `,
      [category_id]
    );

    if (categoryResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Category not found or inactive",
      });
    }

    // Cek supplier
    const supplierResult = await pool.query(
      `
      SELECT id
      FROM app.suppliers
      WHERE id = $1
      AND status = 'ACTIVE'
      `,
      [supplier_id]
    );

    if (supplierResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Supplier not found or inactive",
      });
    }

    const result = await pool.query(
      `
  INSERT INTO app.products (
    sku,
    product_name,
    category_id,
    supplier_id,
    unit,
    purchase_price,
    selling_price,
    minimum_stock,
    current_stock,
    description
  )
  VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, 0, $9
  )
  RETURNING *
  `,
      [
        normalizedSku,
        product_name,
        category_id,
        supplier_id,
        unit || "PCS",
        purchase_price ?? 0,
        selling_price ?? 0,
        minimum_stock ?? 0,
        description || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "SKU already exists",
      });
    }

    console.error("Error creating product:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      sku,
      product_name,
      category_id,
      supplier_id,
      unit,
      purchase_price,
      selling_price,
      minimum_stock,
      description,
    } = req.body;

    const normalizedSku = normalizeSku(sku);

    if (
      !normalizedSku ||
      !product_name ||
      !category_id ||
      !supplier_id
    ) {
      return res.status(400).json({
        success: false,
        message:
          "sku, product_name, category_id, and supplier_id are required",
      });
    }

    const categoryResult = await pool.query(
      `
      SELECT id
      FROM app.categories
      WHERE id = $1
      AND status = 'ACTIVE'
      `,
      [category_id]
    );

    if (categoryResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Category not found or inactive",
      });
    }

    const supplierResult = await pool.query(
      `
      SELECT id
      FROM app.suppliers
      WHERE id = $1
      AND status = 'ACTIVE'
      `,
      [supplier_id]
    );

    if (supplierResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Supplier not found or inactive",
      });
    }

    const result = await pool.query(
      `
      UPDATE app.products
      SET
        sku = $1,
        product_name = $2,
        category_id = $3,
        supplier_id = $4,
        unit = $5,
        purchase_price = $6,
        selling_price = $7,
        minimum_stock = $8,
        description = $9
      WHERE id = $10
      RETURNING *
      `,
      [
        normalizedSku,
        product_name,
        category_id,
        supplier_id,
        unit || "PCS",
        purchase_price ?? 0,
        selling_price ?? 0,
        minimum_stock ?? 0,
        description || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "SKU already exists",
      });
    }

    console.error("Error creating product:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  }
};

const updateProductStatus = async (req, res) => {
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
      UPDATE app.products
      SET status = $1
      WHERE id = $2
      RETURNING *
      `,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product status updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating product status:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update product status",
    });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  updateProductStatus,
};