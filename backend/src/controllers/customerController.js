const pool = require("../config/database");

const getAllCustomers = async (req, res) => {
  try {
    const {
      search = "",
      status,
      city,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(
      Math.max(Number(limit) || 10, 1),
      100
    );
    const offset = (pageNumber - 1) * limitNumber;

    const conditions = [];
    const values = [];

    if (search.trim()) {
      values.push(`%${search.trim()}%`);

      conditions.push(`
        (
          customer_code ILIKE $${values.length}
          OR customer_name ILIKE $${values.length}
          OR COALESCE(contact_person, '') ILIKE $${values.length}
          OR COALESCE(phone, '') ILIKE $${values.length}
          OR COALESCE(email, '') ILIKE $${values.length}
        )
      `);
    }

    if (status) {
      if (!["ACTIVE", "INACTIVE"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be ACTIVE or INACTIVE",
        });
      }

      values.push(status);
      conditions.push(
        `status::TEXT = $${values.length}`
      );
    }

    if (city) {
      values.push(city);
      conditions.push(`city ILIKE $${values.length}`);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::INTEGER AS total
      FROM app.customers
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
        id,
        customer_code,
        customer_name,
        contact_person,
        phone,
        email,
        address,
        city,
        payment_terms_days,
        credit_limit,
        status,
        notes,
        created_at,
        updated_at
      FROM app.customers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${queryValues.length - 1}
      OFFSET $${queryValues.length}
      `,
      queryValues
    );

    const totalData = countResult.rows[0].total;

    res.status(200).json({
      success: true,
      message: "Customers retrieved successfully",
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
    console.error("Error fetching customers:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve customers",
    });
  }
};

const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM app.customers
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer retrieved successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching customer:", error);

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve customer",
    });
  }
};

const createCustomer = async (req, res) => {
  try {
    const {
      customer_code,
      customer_name,
      contact_person,
      phone,
      email,
      address,
      city,
      payment_terms_days = 0,
      credit_limit = 0,
      notes,
    } = req.body;

    if (!customer_code || !customer_name) {
      return res.status(400).json({
        success: false,
        message:
          "customer_code and customer_name are required",
      });
    }

    if (
      !Number.isInteger(Number(payment_terms_days)) ||
      Number(payment_terms_days) < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "payment_terms_days must be a non-negative integer",
      });
    }

    if (
      Number.isNaN(Number(credit_limit)) ||
      Number(credit_limit) < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "credit_limit must be a non-negative number",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO app.customers (
        customer_code,
        customer_name,
        contact_person,
        phone,
        email,
        address,
        city,
        payment_terms_days,
        credit_limit,
        status,
        notes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, 'ACTIVE', $10
      )
      RETURNING *
      `,
      [
        customer_code,
        customer_name,
        contact_person || null,
        phone || null,
        email || null,
        address || null,
        city || null,
        payment_terms_days,
        credit_limit,
        notes || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating customer:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Customer code already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create customer",
    });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      customer_code,
      customer_name,
      contact_person,
      phone,
      email,
      address,
      city,
      payment_terms_days,
      credit_limit,
      notes,
    } = req.body;

    if (
      payment_terms_days !== undefined &&
      (
        !Number.isInteger(Number(payment_terms_days)) ||
        Number(payment_terms_days) < 0
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "payment_terms_days must be a non-negative integer",
      });
    }

    if (
      credit_limit !== undefined &&
      (
        Number.isNaN(Number(credit_limit)) ||
        Number(credit_limit) < 0
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "credit_limit must be a non-negative number",
      });
    }

    const result = await pool.query(
      `
      UPDATE app.customers
      SET
        customer_code =
          COALESCE($1, customer_code),
        customer_name =
          COALESCE($2, customer_name),
        contact_person =
          COALESCE($3, contact_person),
        phone = COALESCE($4, phone),
        email = COALESCE($5, email),
        address = COALESCE($6, address),
        city = COALESCE($7, city),
        payment_terms_days =
          COALESCE($8, payment_terms_days),
        credit_limit =
          COALESCE($9, credit_limit),
        notes = COALESCE($10, notes),
        updated_at = NOW()
      WHERE id = $11
      RETURNING *
      `,
      [
        customer_code,
        customer_name,
        contact_person,
        phone,
        email,
        address,
        city,
        payment_terms_days,
        credit_limit,
        notes,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating customer:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Customer code already exists",
      });
    }

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update customer",
    });
  }
};

const updateCustomerStatus = async (req, res) => {
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
      UPDATE app.customers
      SET
        status = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Customer status updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Error updating customer status:",
      error
    );

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    res.status(500).json({
      success: false,
      message:
        "Failed to update customer status",
    });
  }
};

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  updateCustomerStatus,
};