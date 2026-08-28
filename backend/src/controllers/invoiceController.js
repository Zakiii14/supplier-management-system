const pool = require("../config/database");

const {
  parseDateRange,
} = require("../utils/dateRange");

const getAllInvoices = async (req, res) => {
  try {
    const {
      search = "",
      status = "",
      customer_id = "",
      date_from = "",
      date_to = "",
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

    const allowedStatuses = [
      "UNPAID",
      "PARTIAL",
      "PAID",
      "OVERDUE",
      "CANCELLED",
    ];

    const normalizedStatus =
      typeof status === "string"
        ? status.trim().toUpperCase()
        : "";

    if (
      normalizedStatus &&
      !allowedStatuses.includes(normalizedStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice status",
      });
    }

    const normalizedSearch =
      typeof search === "string"
        ? search.trim()
        : "";

    const normalizedCustomerId =
      typeof customer_id === "string"
        ? customer_id.trim()
        : "";

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      normalizedCustomerId &&
      !uuidPattern.test(normalizedCustomerId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const {
      dateFrom,
      dateTo,
      error: dateRangeError,
    } = parseDateRange(date_from, date_to);

    if (dateRangeError) {
      return res.status(400).json({
        success: false,
        message: dateRangeError,
      });
    }

    const conditions = [];
    const values = [];

    if (normalizedSearch) {
      values.push(`%${normalizedSearch}%`);

      conditions.push(`
        (
          i.invoice_number ILIKE $${values.length}
          OR so.so_number ILIKE $${values.length}
          OR c.customer_code ILIKE $${values.length}
          OR c.customer_name ILIKE $${values.length}
          OR COALESCE(i.notes, '')
            ILIKE $${values.length}
        )
      `);
    }

    if (normalizedStatus === "OVERDUE") {
      conditions.push(`
        (
          i.due_date < CURRENT_DATE
          AND i.status IN (
            'UNPAID',
            'PARTIAL'
          )
        )
      `);
    } else if (
      ["UNPAID", "PARTIAL"].includes(
        normalizedStatus,
      )
    ) {
      values.push(normalizedStatus);

      conditions.push(`
        (
          i.status = $${values.length}
          AND i.due_date >= CURRENT_DATE
        )
      `);
    } else if (normalizedStatus) {
      values.push(normalizedStatus);

      conditions.push(
        `i.status = $${values.length}`,
      );
    }

    if (normalizedCustomerId) {
      values.push(normalizedCustomerId);

      conditions.push(
        `i.customer_id = $${values.length}`,
      );
    }

    if (dateFrom) {
      values.push(dateFrom);

      conditions.push(
        `i.invoice_date >= $${values.length}::DATE`,
      );
    }

    if (dateTo) {
      values.push(dateTo);

      conditions.push(
        `i.invoice_date <= $${values.length}::DATE`,
      );
    }

    const whereClause = conditions.length
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
        CASE
          WHEN
            i.due_date < CURRENT_DATE
            AND i.status IN (
              'UNPAID',
              'PARTIAL'
            )
          THEN 'OVERDUE'::app.invoice_status
          ELSE i.status
        END AS status,
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
      LIMIT $${limitPosition}
      OFFSET $${offsetPosition}
      `,
      listValues,
    );

    res.status(200).json({
      success: true,
      message: "Invoices retrieved successfully",
      data: result.rows,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    console.error(
      "Error fetching invoices:",
      error,
    );

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve invoices",
    });
  }
};

const getInvoiceEligibleSalesOrders = async (
  req,
  res,
) => {
  try {
    const result = await pool.query(
      `
      SELECT
        so.id,
        so.so_number,
        so.customer_id,
        c.customer_code,
        c.customer_name,
        c.contact_person,
        c.phone,
        c.email,
        c.address,
        c.city,
        c.payment_terms_days,
        so.order_date,
        so.requested_delivery_date,
        so.status,
        COALESCE(summary.total_items, 0)
          AS total_items,
        COALESCE(summary.subtotal, 0)
          AS subtotal,
        COALESCE(summary.discount_amount, 0)
          AS discount_amount,
        COALESCE(summary.total_amount, 0)
          AS total_amount
      FROM app.sales_orders so
      JOIN app.customers c
        ON c.id = so.customer_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(soi.id)::INTEGER
            AS total_items,
          COALESCE(
            SUM(
              soi.quantity * soi.unit_price
            ),
            0
          ) AS subtotal,
          COALESCE(
            SUM(soi.discount_amount),
            0
          ) AS discount_amount,
          COALESCE(
            SUM(
              soi.quantity * soi.unit_price
              - soi.discount_amount
            ),
            0
          ) AS total_amount
        FROM app.sales_order_items soi
        WHERE soi.sales_order_id = so.id
      ) summary ON TRUE
      WHERE so.status = 'DELIVERED'
        AND NOT EXISTS (
          SELECT 1
          FROM app.invoices i
          WHERE i.sales_order_id = so.id
        )
      ORDER BY
        so.order_date DESC,
        so.so_number ASC
      `,
    );

    res.status(200).json({
      success: true,
      message:
        "Invoice eligible sales orders retrieved successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error(
      "Error fetching invoice eligible sales orders:",
      error,
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve invoice eligible sales orders",
    });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const invoiceResult = await pool.query(
      `
      SELECT
        i.id,
        i.invoice_number,
        i.sales_order_id,
        so.so_number,
        so.order_date,
        i.customer_id,
        c.customer_code,
        c.customer_name,
        c.contact_person,
        c.phone,
        c.email,
        c.address,
        c.city,
        c.payment_terms_days,
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
        CASE
          WHEN
            i.due_date < CURRENT_DATE
            AND i.status IN (
              'UNPAID',
              'PARTIAL'
            )
          THEN 'OVERDUE'::app.invoice_status
          ELSE i.status
        END AS status,
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
      WHERE i.id = $1
      `,
      [id],
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const itemsResult = await pool.query(
      `
      SELECT
        soi.id,
        soi.product_id,
        p.sku,
        p.product_name,
        p.unit,
        soi.quantity,
        soi.unit_price,
        soi.discount_amount,
        (
          soi.quantity * soi.unit_price
          - soi.discount_amount
        ) AS subtotal
      FROM app.sales_order_items soi
      JOIN app.products p
        ON p.id = soi.product_id
      WHERE soi.sales_order_id = $1
      ORDER BY p.product_name ASC
      `,
      [invoiceResult.rows[0].sales_order_id],
    );

    const paymentsResult = await pool.query(
      `
      SELECT
        p.id,
        p.payment_number,
        p.payment_date,
        p.amount,
        p.method,
        p.reference_number,
        p.notes,
        p.received_by,
        u.full_name AS received_by_name,
        p.created_at
      FROM app.payments p
      LEFT JOIN app.users u
        ON u.id = p.received_by
      WHERE p.invoice_id = $1
      ORDER BY
        p.payment_date DESC,
        p.created_at DESC
      `,
      [id],
    );

    res.status(200).json({
      success: true,
      message:
        "Invoice retrieved successfully",
      data: {
        ...invoiceResult.rows[0],
        items: itemsResult.rows,
        payments: paymentsResult.rows,
      },
    });
  } catch (error) {
    console.error(
      "Error fetching invoice:",
      error,
    );

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
  getInvoiceEligibleSalesOrders,
  getInvoiceById,
  createInvoice,
  cancelInvoice,
};