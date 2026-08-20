const pool = require("../config/database");

const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "GIRO",
  "OTHER",
];

const getAllPayments = async (req, res) => {
  try {
    const {
      search = "",
      method,
      invoice_id,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(
      Math.max(Number(limit) || 10, 1),
      100
    );
    const offset = (pageNumber - 1) * limitNumber;

    if (
      method &&
      !PAYMENT_METHODS.includes(method)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    const conditions = [];
    const values = [];

    if (search.trim()) {
      values.push(`%${search.trim()}%`);

      conditions.push(`
        (
          p.payment_number ILIKE $${values.length}
          OR i.invoice_number ILIKE $${values.length}
          OR so.so_number ILIKE $${values.length}
          OR c.customer_name ILIKE $${values.length}
          OR COALESCE(p.reference_number, '')
            ILIKE $${values.length}
        )
      `);
    }

    if (method) {
      values.push(method);
      conditions.push(
        `p.method::TEXT = $${values.length}`
      );
    }

    if (invoice_id) {
      values.push(invoice_id);
      conditions.push(
        `p.invoice_id = $${values.length}`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::INTEGER AS total

      FROM app.payments p

      JOIN app.invoices i
        ON i.id = p.invoice_id

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
        p.id,
        p.payment_number,
        p.invoice_id,
        i.invoice_number,
        so.so_number,
        i.customer_id,
        c.customer_code,
        c.customer_name,
        p.payment_date,
        p.amount,
        p.method,
        p.reference_number,
        p.notes,
        p.received_by,
        p.created_at

      FROM app.payments p

      JOIN app.invoices i
        ON i.id = p.invoice_id

      JOIN app.sales_orders so
        ON so.id = i.sales_order_id

      JOIN app.customers c
        ON c.id = i.customer_id

      ${whereClause}

      ORDER BY p.created_at DESC

      LIMIT $${queryValues.length - 1}
      OFFSET $${queryValues.length}
      `,
      queryValues
    );

    const totalData = countResult.rows[0].total;

    res.status(200).json({
      success: true,
      message: "Payments retrieved successfully",
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
    console.error("Error fetching payments:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve payments",
    });
  }
};

const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        p.*,
        i.invoice_number,
        i.sales_order_id,
        so.so_number,
        i.customer_id,
        c.customer_code,
        c.customer_name,
        i.grand_total,
        i.paid_amount,
        (
          i.grand_total - i.paid_amount
        ) AS outstanding_amount,
        i.status AS invoice_status

      FROM app.payments p

      JOIN app.invoices i
        ON i.id = p.invoice_id

      JOIN app.sales_orders so
        ON so.id = i.sales_order_id

      JOIN app.customers c
        ON c.id = i.customer_id

      WHERE p.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment retrieved successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching payment:", error);

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve payment",
    });
  }
};

const createPayment = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      payment_number,
      invoice_id,
      payment_date,
      amount,
      method,
      reference_number,
      notes,
      received_by,
    } = req.body;

    if (
      !payment_number ||
      !invoice_id ||
      amount === undefined ||
      !method
    ) {
      return res.status(400).json({
        success: false,
        message:
          "payment_number, invoice_id, amount, and method are required",
      });
    }

    if (
      Number.isNaN(Number(amount)) ||
      Number(amount) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payment amount must be greater than zero",
      });
    }

    if (!PAYMENT_METHODS.includes(method)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    await client.query("BEGIN");

    const invoiceResult = await client.query(
      `
      SELECT
        id,
        invoice_number,
        invoice_date,
        grand_total,
        paid_amount,
        status

      FROM app.invoices

      WHERE id = $1

      FOR UPDATE
      `,
      [invoice_id]
    );

    if (invoiceResult.rows.length === 0) {
      throw new Error("Invoice not found");
    }

    const invoice = invoiceResult.rows[0];

    if (invoice.status === "CANCELLED") {
      throw new Error(
        "Cancelled invoice cannot receive payment"
      );
    }

    if (invoice.status === "PAID") {
      throw new Error(
        "Invoice has already been paid"
      );
    }

    const outstandingAmount =
      Number(invoice.grand_total) -
      Number(invoice.paid_amount);

    if (Number(amount) > outstandingAmount) {
      throw new Error(
        `Payment exceeds outstanding amount (${outstandingAmount})`
      );
    }

    const dateResult = await client.query(
      `
      SELECT
        COALESCE($1::DATE, CURRENT_DATE)
          < $2::DATE AS invalid_date
      `,
      [
        payment_date || null,
        invoice.invoice_date,
      ]
    );

    if (dateResult.rows[0].invalid_date) {
      throw new Error(
        "Payment date cannot be earlier than invoice date"
      );
    }

    const paymentResult = await client.query(
      `
      INSERT INTO app.payments (
        payment_number,
        invoice_id,
        payment_date,
        amount,
        method,
        reference_number,
        notes,
        received_by
      )
      VALUES (
        $1,
        $2,
        COALESCE($3::DATE, CURRENT_DATE),
        $4,
        $5,
        $6,
        $7,
        $8
      )
      RETURNING *
      `,
      [
        payment_number,
        invoice_id,
        payment_date || null,
        amount,
        method,
        reference_number || null,
        notes || null,
        received_by || null,
      ]
    );

    const updatedInvoiceResult =
      await client.query(
        `
        UPDATE app.invoices
        SET
          paid_amount = paid_amount + $1,

          status = CASE
            WHEN paid_amount + $1 >= grand_total
              THEN 'PAID'::app.invoice_status
            ELSE 'PARTIAL'::app.invoice_status
          END,

          updated_at = NOW()

        WHERE id = $2

        RETURNING
          id,
          invoice_number,
          grand_total,
          paid_amount,
          (
            grand_total - paid_amount
          ) AS outstanding_amount,
          status
        `,
        [amount, invoice_id]
      );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Payment created successfully",
      data: {
        payment: paymentResult.rows[0],
        invoice: updatedInvoiceResult.rows[0],
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Error creating payment:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message:
          "Payment number already exists",
      });
    }

    res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to create payment",
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getAllPayments,
  getPaymentById,
  createPayment,
};