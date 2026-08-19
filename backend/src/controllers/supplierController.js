const pool = require("../config/database");

const getAllSuppliers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        supplier_code,
        supplier_name,
        contact_person,
        phone,
        email,
        city,
        payment_terms_days,
        status
      FROM app.suppliers
      ORDER BY supplier_name ASC
    `);

    res.status(200).json({
      success: true,
      message: "Suppliers retrieved successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching suppliers:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve suppliers",
    });
  }
};

const getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        id,
        supplier_code,
        supplier_name,
        contact_person,
        phone,
        email,
        address,
        city,
        payment_terms_days,
        status,
        notes,
        created_at,
        updated_at
      FROM app.suppliers
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Supplier retrieved successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching supplier:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve supplier",
    });
  }
};

const createSupplier = async (req, res) => {
  try {
    const {
      supplier_code,
      supplier_name,
      contact_person,
      phone,
      email,
      address,
      city,
      payment_terms_days,
      notes,
    } = req.body;

    // Validasi field wajib
    if (!supplier_code || !supplier_name) {
      return res.status(400).json({
        success: false,
        message: "supplier_code and supplier_name are required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO app.suppliers (
        supplier_code,
        supplier_name,
        contact_person,
        phone,
        email,
        address,
        city,
        payment_terms_days,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        supplier_code,
        supplier_name,
        contact_person || null,
        phone || null,
        email || null,
        address || null,
        city || null,
        payment_terms_days ?? 0,
        notes || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating supplier:", error);

    // PostgreSQL unique violation
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Supplier code already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create supplier",
    });
  }
};

module.exports = {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
};