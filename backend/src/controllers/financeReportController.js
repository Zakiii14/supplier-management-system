const pool = require("../config/database");
const {
  normalizeText,
  normalizeEnum,
  parseReportQuery,
  validateUuid,
  validateEnum,
  sendReportResponse,
} = require("../utils/reportUtils");

const INVOICE_STATUSES = [
  "UNPAID",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "CANCELLED",
];

const EFFECTIVE_STATUS_SQL = `
  CASE
    WHEN
      i.due_date < CURRENT_DATE
      AND i.status IN ('UNPAID', 'PARTIAL')
    THEN 'OVERDUE'
    ELSE i.status::TEXT
  END
`;

const getFinanceReport = async (req, res) => {
  try {
    const parsed = parseReportQuery(req.query);

    if (parsed.error) {
      return res.status(400).json({
        success: false,
        message: parsed.error,
      });
    }

    const status = normalizeEnum(req.query.status);
    const customerId = normalizeText(
      req.query.customer_id,
    );

    const statusError = validateEnum(
      status,
      INVOICE_STATUSES,
      "Invalid invoice status",
    );

    if (statusError) {
      return res.status(400).json({
        success: false,
        message: statusError,
      });
    }

    const customerIdError = validateUuid(
      customerId,
      "customer ID",
    );

    if (customerIdError) {
      return res.status(400).json({
        success: false,
        message: customerIdError,
      });
    }

    const conditions = [];
    const values = [];

    if (parsed.search) {
      values.push(`%${parsed.search}%`);
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
        `${EFFECTIVE_STATUS_SQL} = $${values.length}`,
      );
    }

    if (customerId) {
      values.push(customerId);
      conditions.push(
        `i.customer_id = $${values.length}`,
      );
    }

    if (parsed.dateFrom) {
      values.push(parsed.dateFrom);
      conditions.push(
        `i.invoice_date >= $${values.length}::DATE`,
      );
    }

    if (parsed.dateTo) {
      values.push(parsed.dateTo);
      conditions.push(
        `i.invoice_date <= $${values.length}::DATE`,
      );
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const reportCte = `
      WITH report_rows AS (
        SELECT
          i.id,
          i.invoice_number,
          i.invoice_date,
          i.due_date,
          ${EFFECTIVE_STATUS_SQL} AS status,
          i.status::TEXT AS stored_status,
          i.subtotal,
          i.discount_amount,
          i.tax_amount,
          i.grand_total,
          i.paid_amount,
          GREATEST(
            i.grand_total - i.paid_amount,
            0
          ) AS outstanding_amount,
          so.id AS sales_order_id,
          so.so_number,
          c.id AS customer_id,
          c.customer_code,
          c.customer_name
        FROM app.invoices i
        JOIN app.sales_orders so
          ON so.id = i.sales_order_id
        JOIN app.customers c
          ON c.id = i.customer_id
        ${whereClause}
      )
    `;

    const paymentConditions = [];
    const paymentValues = [];

    if (parsed.dateFrom) {
      paymentValues.push(parsed.dateFrom);
      paymentConditions.push(
        `p.payment_date >= $${paymentValues.length}::DATE`,
      );
    }

    if (parsed.dateTo) {
      paymentValues.push(parsed.dateTo);
      paymentConditions.push(
        `p.payment_date <= $${paymentValues.length}::DATE`,
      );
    }

    if (customerId) {
      paymentValues.push(customerId);
      paymentConditions.push(
        `i.customer_id = $${paymentValues.length}`,
      );
    }

    const paymentWhereClause =
      paymentConditions.length
        ? `WHERE ${paymentConditions.join(" AND ")}`
        : "";

    const [
      invoiceSummaryResult,
      paymentSummaryResult,
      countResult,
    ] = await Promise.all([
      pool.query(
        `${reportCte}
        SELECT
          COUNT(*)::INTEGER AS total_invoices,
          (COUNT(*) FILTER (
            WHERE status <> 'CANCELLED'
          ))::INTEGER AS active_invoices,
          (COUNT(*) FILTER (
            WHERE status = 'OVERDUE'
          ))::INTEGER AS overdue_invoices,
          (COUNT(*) FILTER (
            WHERE status IN (
              'UNPAID',
              'PARTIAL',
              'OVERDUE'
            )
          ))::INTEGER AS outstanding_invoices,
          COALESCE(
            SUM(grand_total) FILTER (
              WHERE status <> 'CANCELLED'
            ),
            0
          ) AS total_invoice_value,
          COALESCE(
            SUM(paid_amount) FILTER (
              WHERE status <> 'CANCELLED'
            ),
            0
          ) AS total_paid_amount,
          COALESCE(
            SUM(outstanding_amount) FILTER (
              WHERE status IN (
                'UNPAID',
                'PARTIAL',
                'OVERDUE'
              )
            ),
            0
          ) AS outstanding_amount
        FROM report_rows`,
        values,
      ),
      pool.query(
        `
        SELECT
          COUNT(p.id)::INTEGER AS total_payments,
          COALESCE(SUM(p.amount), 0)
            AS payments_received
        FROM app.payments p
        JOIN app.invoices i
          ON i.id = p.invoice_id
        ${paymentWhereClause}
        `,
        paymentValues,
      ),
      pool.query(
        `${reportCte}
        SELECT COUNT(*)::INTEGER AS total
        FROM report_rows`,
        values,
      ),
    ]);

    const trendResult = await pool.query(
      `
      WITH monthly_activity AS (
        SELECT
          DATE_TRUNC('month', i.invoice_date)
            AS period,
          COALESCE(
            SUM(i.grand_total) FILTER (
              WHERE i.status <> 'CANCELLED'
            ),
            0
          ) AS invoice_value,
          0::NUMERIC AS payment_value
        FROM app.invoices i
        WHERE
          ($1::DATE IS NULL OR i.invoice_date >= $1)
          AND ($2::DATE IS NULL OR i.invoice_date <= $2)
          AND ($3::UUID IS NULL OR i.customer_id = $3)
        GROUP BY DATE_TRUNC('month', i.invoice_date)

        UNION ALL

        SELECT
          DATE_TRUNC('month', p.payment_date),
          0::NUMERIC,
          COALESCE(SUM(p.amount), 0)
        FROM app.payments p
        JOIN app.invoices i
          ON i.id = p.invoice_id
        WHERE
          ($1::DATE IS NULL OR p.payment_date >= $1)
          AND ($2::DATE IS NULL OR p.payment_date <= $2)
          AND ($3::UUID IS NULL OR i.customer_id = $3)
        GROUP BY DATE_TRUNC('month', p.payment_date)
      )
      SELECT
        TO_CHAR(period, 'YYYY-MM') AS period,
        COALESCE(SUM(invoice_value), 0)
          AS invoice_value,
        COALESCE(SUM(payment_value), 0)
          AS payment_value
      FROM monthly_activity
      GROUP BY period
      ORDER BY period ASC
      `,
      [
        parsed.dateFrom || null,
        parsed.dateTo || null,
        customerId || null,
      ],
    );

    const total = countResult.rows[0].total;
    const rowsResult = await pool.query(
      `${reportCte}
      SELECT *
      FROM report_rows
      ORDER BY invoice_date DESC, invoice_number DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}`,
      [
        ...values,
        parsed.limit,
        parsed.offset,
      ],
    );

    sendReportResponse({
      res,
      message: "Finance report retrieved successfully",
      filters: {
        search: parsed.search,
        status,
        customer_id: customerId,
        date_from: parsed.dateFrom,
        date_to: parsed.dateTo,
      },
      summary: {
        ...invoiceSummaryResult.rows[0],
        ...paymentSummaryResult.rows[0],
      },
      trend: trendResult.rows,
      rows: rowsResult.rows,
      page: parsed.page,
      limit: parsed.limit,
      total,
    });
  } catch (error) {
    console.error(
      "Error fetching finance report:",
      error,
    );

    res.status(500).json({
      success: false,
      message: "Failed to retrieve finance report",
    });
  }
};

module.exports = {
  getFinanceReport,
};
