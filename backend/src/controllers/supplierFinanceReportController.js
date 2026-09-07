const pool = require("../config/database");
const { sendReportResponse } = require("../utils/reportUtils");
const {
  SUPPLIER_FINANCE_CTE,
  buildSupplierFinanceFilter,
  parseSupplierFinanceQuery,
} = require("../services/supplierFinanceReportService");

const getSupplierFinanceReport = async (req, res) => {
  try {
    const parsed = parseSupplierFinanceQuery(req.query);
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const { values, whereClause } = buildSupplierFinanceFilter(parsed);
    const filteredCte = `
      ${SUPPLIER_FINANCE_CTE},
      filtered_supplier_finance AS (
        SELECT *
        FROM supplier_finance_rows sfr
        ${whereClause}
      )
    `;

    const [summaryResult, trendResult, countResult, rowsResult] =
      await Promise.all([
        pool.query(
          `${filteredCte}
          SELECT
            COUNT(*)::INTEGER AS total_purchase_orders,
            (COUNT(*) FILTER (
              WHERE payment_status <> 'CANCELLED'
            ))::INTEGER AS active_purchase_orders,
            (COUNT(*) FILTER (
              WHERE payment_status = 'OVERDUE'
            ))::INTEGER AS overdue_purchase_orders,
            COALESCE(SUM(total_amount) FILTER (
              WHERE payment_status <> 'CANCELLED'
            ), 0) AS total_purchase_value,
            COALESCE(SUM(paid_amount) FILTER (
              WHERE payment_status <> 'CANCELLED'
            ), 0) AS supplier_payments_made,
            COALESCE(SUM(outstanding_amount) FILTER (
              WHERE payment_status NOT IN ('PAID', 'CANCELLED')
            ), 0) AS supplier_outstanding_amount,
            COALESCE(SUM(outstanding_amount) FILTER (
              WHERE payment_status = 'OVERDUE'
            ), 0) AS overdue_supplier_amount
          FROM filtered_supplier_finance`,
          values,
        ),
        pool.query(
          `${filteredCte}, monthly_activity AS (
            SELECT
              DATE_TRUNC('month', fsf.order_date) AS period,
              COALESCE(SUM(fsf.total_amount), 0) AS purchase_value,
              0::NUMERIC AS supplier_payment_value
            FROM filtered_supplier_finance fsf
            WHERE fsf.payment_status <> 'CANCELLED'
            GROUP BY DATE_TRUNC('month', fsf.order_date)

            UNION ALL

            SELECT
              DATE_TRUNC('month', sp.payment_date),
              0::NUMERIC,
              COALESCE(SUM(sp.amount), 0)
            FROM filtered_supplier_finance fsf
            JOIN app.supplier_payments sp
              ON sp.purchase_order_id = fsf.id
            WHERE fsf.payment_status <> 'CANCELLED'
            GROUP BY DATE_TRUNC('month', sp.payment_date)
          )
          SELECT
            TO_CHAR(period, 'YYYY-MM') AS period,
            COALESCE(SUM(purchase_value), 0) AS purchase_value,
            COALESCE(SUM(supplier_payment_value), 0)
              AS supplier_payment_value
          FROM monthly_activity
          GROUP BY period
          ORDER BY period ASC`,
          values,
        ),
        pool.query(
          `${filteredCte}
          SELECT COUNT(*)::INTEGER AS total
          FROM filtered_supplier_finance`,
          values,
        ),
        pool.query(
          `${filteredCte}
          SELECT
            id,
            po_number,
            order_date,
            estimated_due_date,
            payment_status,
            payment_scheme,
            supplier_code,
            supplier_name,
            total_amount,
            paid_amount,
            outstanding_amount,
            payment_count,
            proof_count
          FROM filtered_supplier_finance
          ORDER BY order_date DESC, po_number DESC
          LIMIT $${values.length + 1}
          OFFSET $${values.length + 2}`,
          [...values, parsed.limit, parsed.offset],
        ),
      ]);

    const total = countResult.rows[0].total;
    sendReportResponse({
      res,
      message: "Supplier finance report retrieved successfully",
      filters: {
        search: parsed.search,
        payment_status: parsed.paymentStatus,
        supplier_id: parsed.supplierId,
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
    console.error("Error fetching supplier finance report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve supplier finance report",
    });
  }
};

module.exports = { getSupplierFinanceReport };
