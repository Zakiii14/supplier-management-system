const pool = require("../config/database");

const getAllInvoices = async (req, res) => {
  try {
    const {
      search = "",
      status,
      customer_id,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(
      Math.max(Number(limit) || 10, 1),
      100
    );
    const offset = (pageNumber - 1) * limitNumber;

    const allowedStatuses = [
      "UNPAID",
      "PARTIAL",
      "PAID",
      "OVERDUE",
      "CANCELLED",
    ];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice status",
      });
    }

    const conditions = [];
    const values = [];

    if (search.trim()) {
      values.push(`%${search.trim()}%`);

      conditions.push(`
        (
          i.invoice_number ILIKE $${values.length}
          OR so.so_number ILIKE $${values.length}
          OR c.customer_code ILIKE $${values.length}
          OR c.customer_name ILIKE $${values.length}
        )
      `);
    }

    if (status) {
      values.push(status);
      conditions.push(
        `i.status::TEXT = $${values.length}`
      );
    }

    if (customer_id) {
      values.push(customer_id);
      conditions.push(
        `i.customer_id = $${values.length}`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::INTEGER AS total
      FROM app.invoices i
      JOIN app.sales_orders so
        ON so.id = i.sales_order_id
      JOIN app.customers c
        ON c.id = i.customer_id
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
        i.id,
        i.invoice_number,
        i.sales_order_id,
        so.so_number,
        i.customer_id,
        c.customer_code,
        c.customer_name,
        i.invoice_date,
        i.due_date,
        i.subtotal,
        i.discount_amount,
        i.tax_amount,
        i.grand_total,
        i.paid_amount,
        (
          i.grand_total - i.paid_amount
        ) AS outstanding_amount,
        i.status,
        (
          i.due_date < CURRENT_DATE
          AND i.status IN (
            'UNPAID',
            'PARTIAL'
          )
        ) AS is_overdue,
        i.notes,
        i.created_at,
        i.updated_at

      FROM app.invoices i

      JOIN app.sales_orders so
        ON so.id = i.sales_order_id

      JOIN app.customers c
        ON c.id = i.customer_id

      ${whereClause}

      ORDER BY i.created_at DESC

      LIMIT $${queryValues.length - 1}
      OFFSET $${queryValues.length}
      `,
      queryValues
    );

    const totalData = countResult.rows[0].total;

    res.status(200).json({
      success: true,
      message: "Invoices retrieved successfully",
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
    console.error("Error fetching invoices:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve invoices",
    });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        i.*,
        so.so_number,
        so.order_date,
        c.customer_code,
        c.customer_name,
        c.contact_person,
        c.phone,
        c.email,
        c.address,
        c.city,
        c.payment_terms_days,
        (
          i.grand_total - i.paid_amount
        ) AS outstanding_amount,
        (
          i.due_date < CURRENT_DATE
          AND i.status IN (
            'UNPAID',
            'PARTIAL'
          )
        ) AS is_overdue

      FROM app.invoices i

      JOIN app.sales_orders so
        ON so.id = i.sales_order_id

      JOIN app.customers c
        ON c.id = i.customer_id

      WHERE i.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Invoice retrieved successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching invoice:", error);

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve invoice",
    });
  }
};

const createInvoice = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      invoice_number,
      sales_order_id,
      invoice_date,
      tax_amount = 0,
      notes,
    } = req.body;

    if (!invoice_number || !sales_order_id) {
      return res.status(400).json({
        success: false,
        message:
          "invoice_number and sales_order_id are required",
      });
    }

    if (
      Number.isNaN(Number(tax_amount)) ||
      Number(tax_amount) < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "tax_amount must be a non-negative number",
      });
    }

    await client.query("BEGIN");

    const orderResult = await client.query(
      `
      SELECT
        so.id,
        so.so_number,
        so.customer_id,
        so.status,
        c.payment_terms_days

      FROM app.sales_orders so

      JOIN app.customers c
        ON c.id = so.customer_id

      WHERE so.id = $1

      FOR UPDATE OF so
      `,
      [sales_order_id]
    );

    if (orderResult.rows.length === 0) {
      throw new Error("Sales order not found");
    }

    const salesOrder = orderResult.rows[0];

    if (salesOrder.status !== "DELIVERED") {
      throw new Error(
        "Sales order must be DELIVERED before invoicing"
      );
    }

    const existingResult = await client.query(
      `
      SELECT id
      FROM app.invoices
      WHERE sales_order_id = $1
      `,
      [sales_order_id]
    );

    if (existingResult.rows.length > 0) {
      throw new Error(
        "Invoice already exists for this sales order"
      );
    }

    const totalResult = await client.query(
      `
      SELECT
        COALESCE(
          SUM(quantity * unit_price),
          0
        ) AS subtotal,

        COALESCE(
          SUM(discount_amount),
          0
        ) AS discount_amount

      FROM app.sales_order_items

      WHERE sales_order_id = $1
      `,
      [sales_order_id]
    );

    const subtotal = Number(
      totalResult.rows[0].subtotal
    );

    const discountAmount = Number(
      totalResult.rows[0].discount_amount
    );

    const taxAmount = Number(tax_amount);

    const grandTotal =
      subtotal - discountAmount + taxAmount;

    const invoiceResult = await client.query(
      `
      INSERT INTO app.invoices (
        invoice_number,
        sales_order_id,
        customer_id,
        invoice_date,
        due_date,
        subtotal,
        discount_amount,
        tax_amount,
        grand_total,
        paid_amount,
        status,
        notes
      )
      VALUES (
        $1,
        $2,
        $3,
        COALESCE($4::DATE, CURRENT_DATE),
        COALESCE($4::DATE, CURRENT_DATE)
          + $5::INTEGER,
        $6,
        $7,
        $8,
        $9,
        0,
        'UNPAID',
        $10
      )
      RETURNING *
      `,
      [
        invoice_number,
        sales_order_id,
        salesOrder.customer_id,
        invoice_date || null,
        salesOrder.payment_terms_days,
        subtotal,
        discountAmount,
        taxAmount,
        grandTotal,
        notes || null,
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: invoiceResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Error creating invoice:", error);

    if (error.code === "23505") {
      if (
        error.constraint ===
        "invoices_sales_order_id_key"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Invoice already exists for this sales order",
        });
      }

      return res.status(409).json({
        success: false,
        message:
          "Invoice number already exists",
      });
    }

    res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to create invoice",
    });
  } finally {
    client.release();
  }
};

const cancelInvoice = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    const invoiceResult = await client.query(
      `
      SELECT
        id,
        status,
        paid_amount
      FROM app.invoices
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (invoiceResult.rows.length === 0) {
      throw new Error("Invoice not found");
    }

    const invoice = invoiceResult.rows[0];

    if (
      !["UNPAID", "OVERDUE"].includes(
        invoice.status
      )
    ) {
      throw new Error(
        "Only unpaid invoices can be cancelled"
      );
    }

    if (Number(invoice.paid_amount) > 0) {
      throw new Error(
        "Invoice with payment cannot be cancelled"
      );
    }

    const result = await client.query(
      `
      UPDATE app.invoices
      SET
        status = 'CANCELLED',
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    await client.query("COMMIT");

    res.status(200).json({
      success: true,
      message: "Invoice cancelled successfully",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Error cancelling invoice:", error);

    res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to cancel invoice",
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  cancelInvoice,
};