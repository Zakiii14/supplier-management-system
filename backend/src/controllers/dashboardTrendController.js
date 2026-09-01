const pool = require("../config/database");

const ALLOWED_MONTHS = new Set([6, 12]);

const ROLE_TREND_TYPES = {
  ADMIN: "business",
  PURCHASING: "purchasing",
  WAREHOUSE: "inventory",
  SALES: "sales",
  FINANCE: "finance",
  MANAGER: "business",
};

const PERIODS_CTE = `
  WITH periods AS (
    SELECT GENERATE_SERIES(
      DATE_TRUNC('month', CURRENT_DATE)
        - (($1::INTEGER - 1) * INTERVAL '1 month'),
      DATE_TRUNC('month', CURRENT_DATE),
      INTERVAL '1 month'
    )::DATE AS period
  )
`;

const TREND_CONFIG = {
  business: {
    title: "Tren pembelian dan penjualan",
    description:
      "Perbandingan nilai pembelian dan penjualan per bulan.",
    metrics: [
      {
        field: "purchase_value",
        label: "Nilai pembelian",
        format: "currency",
      },
      {
        field: "sales_value",
        label: "Nilai penjualan",
        format: "currency",
      },
    ],
    query: `
      ${PERIODS_CTE},
      purchase_activity AS (
        SELECT
          DATE_TRUNC('month', po.order_date)::DATE
            AS period,
          COALESCE(
            SUM(poi.quantity * poi.unit_price),
            0
          ) AS purchase_value
        FROM app.purchase_orders po
        JOIN app.purchase_order_items poi
          ON poi.purchase_order_id = po.id
        WHERE po.status <> 'CANCELLED'
          AND po.order_date >= (
            SELECT MIN(period) FROM periods
          )
          AND po.order_date <
            DATE_TRUNC('month', CURRENT_DATE)
              + INTERVAL '1 month'
        GROUP BY DATE_TRUNC('month', po.order_date)
      ),
      sales_activity AS (
        SELECT
          DATE_TRUNC('month', so.order_date)::DATE
            AS period,
          COALESCE(
            SUM(soi.quantity * soi.unit_price),
            0
          ) AS sales_value
        FROM app.sales_orders so
        JOIN app.sales_order_items soi
          ON soi.sales_order_id = so.id
        WHERE so.status <> 'CANCELLED'
          AND so.order_date >= (
            SELECT MIN(period) FROM periods
          )
          AND so.order_date <
            DATE_TRUNC('month', CURRENT_DATE)
              + INTERVAL '1 month'
        GROUP BY DATE_TRUNC('month', so.order_date)
      )
      SELECT
        TO_CHAR(p.period, 'YYYY-MM') AS period,
        COALESCE(pa.purchase_value, 0)
          AS purchase_value,
        COALESCE(sa.sales_value, 0)
          AS sales_value
      FROM periods p
      LEFT JOIN purchase_activity pa
        ON pa.period = p.period
      LEFT JOIN sales_activity sa
        ON sa.period = p.period
      ORDER BY p.period ASC
    `,
  },

  purchasing: {
    title: "Tren nilai pembelian",
    description:
      "Perubahan nilai purchase order per bulan.",
    metrics: [
      {
        field: "purchase_value",
        label: "Nilai pembelian",
        format: "currency",
      },
    ],
    query: `
      ${PERIODS_CTE},
      purchase_activity AS (
        SELECT
          DATE_TRUNC('month', po.order_date)::DATE
            AS period,
          COALESCE(
            SUM(poi.quantity * poi.unit_price),
            0
          ) AS purchase_value
        FROM app.purchase_orders po
        JOIN app.purchase_order_items poi
          ON poi.purchase_order_id = po.id
        WHERE po.status <> 'CANCELLED'
          AND po.order_date >= (
            SELECT MIN(period) FROM periods
          )
          AND po.order_date <
            DATE_TRUNC('month', CURRENT_DATE)
              + INTERVAL '1 month'
        GROUP BY DATE_TRUNC('month', po.order_date)
      )
      SELECT
        TO_CHAR(p.period, 'YYYY-MM') AS period,
        COALESCE(pa.purchase_value, 0)
          AS purchase_value
      FROM periods p
      LEFT JOIN purchase_activity pa
        ON pa.period = p.period
      ORDER BY p.period ASC
    `,
  },

  inventory: {
    title: "Tren pergerakan persediaan",
    description:
      "Perbandingan jumlah stok masuk dan keluar per bulan.",
    metrics: [
      {
        field: "stock_in_quantity",
        label: "Stok masuk",
        format: "number",
      },
      {
        field: "stock_out_quantity",
        label: "Stok keluar",
        format: "number",
      },
    ],
    query: `
      ${PERIODS_CTE},
      inventory_activity AS (
        SELECT
          DATE_TRUNC(
            'month',
            im.movement_date
          )::DATE AS period,
          COALESCE(
            SUM(im.quantity) FILTER (
              WHERE im.movement_type IN (
                'PURCHASE_RECEIPT',
                'ADJUSTMENT_IN',
                'RETURN_IN'
              )
            ),
            0
          ) AS stock_in_quantity,
          COALESCE(
            SUM(im.quantity) FILTER (
              WHERE im.movement_type IN (
                'SALES_ISSUE',
                'ADJUSTMENT_OUT',
                'RETURN_OUT'
              )
            ),
            0
          ) AS stock_out_quantity
        FROM app.inventory_movements im
        WHERE im.movement_date >= (
          SELECT MIN(period) FROM periods
        )
          AND im.movement_date <
            DATE_TRUNC('month', CURRENT_DATE)
              + INTERVAL '1 month'
        GROUP BY DATE_TRUNC(
          'month',
          im.movement_date
        )
      )
      SELECT
        TO_CHAR(p.period, 'YYYY-MM') AS period,
        COALESCE(ia.stock_in_quantity, 0)
          AS stock_in_quantity,
        COALESCE(ia.stock_out_quantity, 0)
          AS stock_out_quantity
      FROM periods p
      LEFT JOIN inventory_activity ia
        ON ia.period = p.period
      ORDER BY p.period ASC
    `,
  },

  sales: {
    title: "Tren nilai penjualan",
    description:
      "Perubahan nilai sales order per bulan.",
    metrics: [
      {
        field: "sales_value",
        label: "Nilai penjualan",
        format: "currency",
      },
    ],
    query: `
      ${PERIODS_CTE},
      sales_activity AS (
        SELECT
          DATE_TRUNC('month', so.order_date)::DATE
            AS period,
          COALESCE(
            SUM(soi.quantity * soi.unit_price),
            0
          ) AS sales_value
        FROM app.sales_orders so
        JOIN app.sales_order_items soi
          ON soi.sales_order_id = so.id
        WHERE so.status <> 'CANCELLED'
          AND so.order_date >= (
            SELECT MIN(period) FROM periods
          )
          AND so.order_date <
            DATE_TRUNC('month', CURRENT_DATE)
              + INTERVAL '1 month'
        GROUP BY DATE_TRUNC('month', so.order_date)
      )
      SELECT
        TO_CHAR(p.period, 'YYYY-MM') AS period,
        COALESCE(sa.sales_value, 0)
          AS sales_value
      FROM periods p
      LEFT JOIN sales_activity sa
        ON sa.period = p.period
      ORDER BY p.period ASC
    `,
  },

  finance: {
    title: "Tren invoice dan pembayaran",
    description:
      "Perbandingan nilai invoice dan pembayaran diterima per bulan.",
    metrics: [
      {
        field: "invoice_value",
        label: "Nilai invoice",
        format: "currency",
      },
      {
        field: "payment_value",
        label: "Nilai pembayaran",
        format: "currency",
      },
    ],
    query: `
      ${PERIODS_CTE},
      invoice_activity AS (
        SELECT
          DATE_TRUNC('month', i.invoice_date)::DATE
            AS period,
          COALESCE(SUM(i.grand_total), 0)
            AS invoice_value
        FROM app.invoices i
        WHERE i.status <> 'CANCELLED'
          AND i.invoice_date >= (
            SELECT MIN(period) FROM periods
          )
          AND i.invoice_date <
            DATE_TRUNC('month', CURRENT_DATE)
              + INTERVAL '1 month'
        GROUP BY DATE_TRUNC('month', i.invoice_date)
      ),
      payment_activity AS (
        SELECT
          DATE_TRUNC('month', p.payment_date)::DATE
            AS period,
          COALESCE(SUM(p.amount), 0)
            AS payment_value
        FROM app.payments p
        WHERE p.payment_date >= (
          SELECT MIN(period) FROM periods
        )
          AND p.payment_date <
            DATE_TRUNC('month', CURRENT_DATE)
              + INTERVAL '1 month'
        GROUP BY DATE_TRUNC('month', p.payment_date)
      )
      SELECT
        TO_CHAR(p.period, 'YYYY-MM') AS period,
        COALESCE(ia.invoice_value, 0)
          AS invoice_value,
        COALESCE(pa.payment_value, 0)
          AS payment_value
      FROM periods p
      LEFT JOIN invoice_activity ia
        ON ia.period = p.period
      LEFT JOIN payment_activity pa
        ON pa.period = p.period
      ORDER BY p.period ASC
    `,
  },
};

const getDashboardTrends = async (req, res) => {
  try {
    const requestedMonths =
      req.query.months === undefined
        ? 6
        : Number(req.query.months);

    if (
      !Number.isInteger(requestedMonths) ||
      !ALLOWED_MONTHS.has(requestedMonths)
    ) {
      return res.status(400).json({
        success: false,
        message: "months must be either 6 or 12",
      });
    }

    const trendType =
      ROLE_TREND_TYPES[req.user.role];

    const config = TREND_CONFIG[trendType];

    if (!config) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have access to dashboard trends",
      });
    }

    const result = await pool.query(
      config.query,
      [requestedMonths],
    );

    res.status(200).json({
      success: true,
      message:
        "Dashboard trends retrieved successfully",
      data: {
        generated_at: new Date().toISOString(),
        months: requestedMonths,
        type: trendType,
        title: config.title,
        description: config.description,
        metrics: config.metrics,
        trend: result.rows,
      },
    });
  } catch (error) {
    console.error(
      "Error fetching dashboard trends:",
      error,
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve dashboard trends",
    });
  }
};

module.exports = {
  getDashboardTrends,
};