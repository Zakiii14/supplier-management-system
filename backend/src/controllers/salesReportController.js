const pool = require("../config/database");
const {
  normalizeText,
  normalizeEnum,
  parseReportQuery,
  validateUuid,
  validateEnum,
  sendReportResponse,
} = require("../utils/reportUtils");

const SALES_ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "CANCELLED",
];

const getSalesReport = async (req, res) => {
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
      SALES_ORDER_STATUSES,
      "Invalid sales order status",
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
          so.so_number ILIKE $${values.length}
          OR c.customer_code ILIKE $${values.length}
          OR c.customer_name ILIKE $${values.length}
        )
      `);
    }

    if (status) {
      values.push(status);
      conditions.push(
        `so.status = $${values.length}`,
      );
    }

    if (customerId) {
      values.push(customerId);
      conditions.push(
        `so.customer_id = $${values.length}`,
      );
    }

    if (parsed.dateFrom) {
      values.push(parsed.dateFrom);
      conditions.push(
        `so.order_date >= $${values.length}::DATE`,
      );
    }

    if (parsed.dateTo) {
      values.push(parsed.dateTo);
      conditions.push(
        `so.order_date <= $${values.length}::DATE`,
      );
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const reportCte = `
      WITH delivered_totals AS (
        SELECT
          soi.sales_order_id,
          COALESCE(
            SUM(di.quantity_delivered) FILTER (
              WHERE d.status = 'DELIVERED'
            ),
            0
          ) AS delivered_quantity
        FROM app.sales_order_items soi
        LEFT JOIN app.delivery_items di
          ON di.sales_order_item_id = soi.id
        LEFT JOIN app.deliveries d
          ON d.id = di.delivery_id
        GROUP BY soi.sales_order_id
      ),
      report_rows AS (
        SELECT
          so.id,
          so.so_number,
          so.order_date,
          so.requested_delivery_date,
          so.status,
          c.id AS customer_id,
          c.customer_code,
          c.customer_name,
          COUNT(soi.id)::INTEGER AS total_items,
          COALESCE(SUM(soi.quantity), 0)
            AS ordered_quantity,
          COALESCE(dt.delivered_quantity, 0)
            AS delivered_quantity,
          GREATEST(
            COALESCE(SUM(soi.quantity), 0)
              - COALESCE(dt.delivered_quantity, 0),
            0
          ) AS pending_delivery_quantity,
          COALESCE(
            SUM(
              GREATEST(
                soi.quantity * soi.unit_price
                  - soi.discount_amount,
                0
              )
            ),
            0
          ) AS total_amount
        FROM app.sales_orders so
        JOIN app.customers c
          ON c.id = so.customer_id
        LEFT JOIN app.sales_order_items soi
          ON soi.sales_order_id = so.id
        LEFT JOIN delivered_totals dt
          ON dt.sales_order_id = so.id
        ${whereClause}
        GROUP BY so.id, c.id, dt.delivered_quantity
      )
    `;

    const [
      summaryResult,
      trendResult,
      countResult,
    ] = await Promise.all([
      pool.query(
        `${reportCte}
        SELECT
          COUNT(*)::INTEGER AS total_sales_orders,
          (COUNT(*) FILTER (
            WHERE status <> 'CANCELLED'
          ))::INTEGER AS active_sales_orders,
          (COUNT(DISTINCT customer_id) FILTER (
            WHERE status <> 'CANCELLED'
          ))::INTEGER AS total_customers,
          COALESCE(
            SUM(total_amount) FILTER (
              WHERE status <> 'CANCELLED'
            ),
            0
          ) AS total_sales_value,
          COALESCE(
            SUM(ordered_quantity) FILTER (
              WHERE status <> 'CANCELLED'
            ),
            0
          ) AS ordered_quantity,
          COALESCE(
            SUM(delivered_quantity) FILTER (
              WHERE status <> 'CANCELLED'
            ),
            0
          ) AS delivered_quantity,
          COALESCE(
            SUM(pending_delivery_quantity) FILTER (
              WHERE status <> 'CANCELLED'
            ),
            0
          ) AS pending_delivery_quantity
        FROM report_rows`,
        values,
      ),
      pool.query(
        `${reportCte}
        SELECT
          TO_CHAR(
            DATE_TRUNC('month', order_date),
            'YYYY-MM'
          ) AS period,
          (COUNT(*) FILTER (
            WHERE status <> 'CANCELLED'
          ))::INTEGER AS total_orders,
          COALESCE(
            SUM(total_amount) FILTER (
              WHERE status <> 'CANCELLED'
            ),
            0
          ) AS total_value,
          COALESCE(
            SUM(delivered_quantity) FILTER (
              WHERE status <> 'CANCELLED'
            ),
            0
          ) AS delivered_quantity
        FROM report_rows
        GROUP BY DATE_TRUNC('month', order_date)
        ORDER BY DATE_TRUNC('month', order_date) ASC`,
        values,
      ),
      pool.query(
        `${reportCte}
        SELECT COUNT(*)::INTEGER AS total
        FROM report_rows`,
        values,
      ),
    ]);

    const total = countResult.rows[0].total;
    const rowsResult = await pool.query(
      `${reportCte}
      SELECT *
      FROM report_rows
      ORDER BY order_date DESC, so_number DESC
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
      message: "Sales report retrieved successfully",
      filters: {
        search: parsed.search,
        status,
        customer_id: customerId,
        date_from: parsed.dateFrom,
        date_to: parsed.dateTo,
      },
      summary: summaryResult.rows[0],
      trend: trendResult.rows,
      rows: rowsResult.rows,
      page: parsed.page,
      limit: parsed.limit,
      total,
    });
  } catch (error) {
    console.error(
      "Error fetching sales report:",
      error,
    );

    res.status(500).json({
      success: false,
      message: "Failed to retrieve sales report",
    });
  }
};

module.exports = {
  getSalesReport,
};
