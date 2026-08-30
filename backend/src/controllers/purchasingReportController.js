const pool = require("../config/database");
const {
  normalizeText,
  normalizeEnum,
  parseReportQuery,
  validateUuid,
  validateEnum,
  sendReportResponse,
} = require("../utils/reportUtils");

const PURCHASE_ORDER_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
];

const getPurchasingReport = async (req, res) => {
  try {
    const parsed = parseReportQuery(req.query);

    if (parsed.error) {
      return res.status(400).json({
        success: false,
        message: parsed.error,
      });
    }

    const status = normalizeEnum(req.query.status);
    const supplierId = normalizeText(
      req.query.supplier_id,
    );

    const statusError = validateEnum(
      status,
      PURCHASE_ORDER_STATUSES,
      "Invalid purchase order status",
    );

    if (statusError) {
      return res.status(400).json({
        success: false,
        message: statusError,
      });
    }

    const supplierIdError = validateUuid(
      supplierId,
      "supplier ID",
    );

    if (supplierIdError) {
      return res.status(400).json({
        success: false,
        message: supplierIdError,
      });
    }

    const conditions = [];
    const values = [];

    if (parsed.search) {
      values.push(`%${parsed.search}%`);
      conditions.push(`
        (
          po.po_number ILIKE $${values.length}
          OR s.supplier_code ILIKE $${values.length}
          OR s.supplier_name ILIKE $${values.length}
        )
      `);
    }

    if (status) {
      values.push(status);
      conditions.push(
        `po.status = $${values.length}`,
      );
    }

    if (supplierId) {
      values.push(supplierId);
      conditions.push(
        `po.supplier_id = $${values.length}`,
      );
    }

    if (parsed.dateFrom) {
      values.push(parsed.dateFrom);
      conditions.push(
        `po.order_date >= $${values.length}::DATE`,
      );
    }

    if (parsed.dateTo) {
      values.push(parsed.dateTo);
      conditions.push(
        `po.order_date <= $${values.length}::DATE`,
      );
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const reportCte = `
      WITH report_rows AS (
        SELECT
          po.id,
          po.po_number,
          po.order_date,
          po.expected_date,
          po.status,
          s.id AS supplier_id,
          s.supplier_code,
          s.supplier_name,
          COUNT(poi.id)::INTEGER AS total_items,
          COALESCE(SUM(poi.quantity), 0)
            AS ordered_quantity,
          COALESCE(SUM(poi.received_quantity), 0)
            AS received_quantity,
          COALESCE(
            SUM(
              GREATEST(
                poi.quantity - poi.received_quantity,
                0
              )
            ),
            0
          ) AS pending_receipt_quantity,
          COALESCE(
            SUM(poi.quantity * poi.unit_price),
            0
          ) AS total_amount
        FROM app.purchase_orders po
        JOIN app.suppliers s
          ON s.id = po.supplier_id
        LEFT JOIN app.purchase_order_items poi
          ON poi.purchase_order_id = po.id
        ${whereClause}
        GROUP BY po.id, s.id
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
          COUNT(*)::INTEGER AS total_purchase_orders,
          (COUNT(*) FILTER (
            WHERE status <> 'CANCELLED'
          ))::INTEGER AS active_purchase_orders,
          COALESCE(
            SUM(total_amount) FILTER (
              WHERE status <> 'CANCELLED'
            ),
            0
          ) AS total_purchase_value,
          COALESCE(
            SUM(ordered_quantity) FILTER (
              WHERE status <> 'CANCELLED'
            ),
            0
          ) AS ordered_quantity,
          COALESCE(
            SUM(received_quantity) FILTER (
              WHERE status <> 'CANCELLED'
            ),
            0
          ) AS received_quantity,
          COALESCE(
            SUM(pending_receipt_quantity) FILTER (
              WHERE status <> 'CANCELLED'
            ),
            0
          ) AS pending_receipt_quantity
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
            SUM(received_quantity) FILTER (
              WHERE status <> 'CANCELLED'
            ),
            0
          ) AS received_quantity
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
      ORDER BY order_date DESC, po_number DESC
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
      message:
        "Purchasing report retrieved successfully",
      filters: {
        search: parsed.search,
        status,
        supplier_id: supplierId,
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
      "Error fetching purchasing report:",
      error,
    );

    res.status(500).json({
      success: false,
      message: "Failed to retrieve purchasing report",
    });
  }
};

module.exports = {
  getPurchasingReport,
};
