const pool = require("../config/database");
const {
  normalizeText,
  normalizeEnum,
  parseReportQuery,
  validateUuid,
  validateEnum,
  sendReportResponse,
} = require("../utils/reportUtils");

const STOCK_STATUSES = [
  "AVAILABLE",
  "LOW",
  "OUT",
];

const INBOUND_MOVEMENT_TYPES = [
  "PURCHASE_RECEIPT",
  "ADJUSTMENT_IN",
  "RETURN_IN",
];

const OUTBOUND_MOVEMENT_TYPES = [
  "SALES_ISSUE",
  "ADJUSTMENT_OUT",
  "RETURN_OUT",
];

const getInventoryReport = async (req, res) => {
  try {
    const parsed = parseReportQuery(req.query);

    if (parsed.error) {
      return res.status(400).json({
        success: false,
        message: parsed.error,
      });
    }

    const categoryId = normalizeText(
      req.query.category_id,
    );
    const stockStatus = normalizeEnum(
      req.query.stock_status,
    );

    const stockStatusError = validateEnum(
      stockStatus,
      STOCK_STATUSES,
      "Invalid stock status",
    );

    if (stockStatusError) {
      return res.status(400).json({
        success: false,
        message: stockStatusError,
      });
    }

    const categoryIdError = validateUuid(
      categoryId,
      "category ID",
    );

    if (categoryIdError) {
      return res.status(400).json({
        success: false,
        message: categoryIdError,
      });
    }

    const values = [];
    const movementConditions = [];
    const productConditions = [
      "p.status = 'ACTIVE'",
    ];

    if (parsed.dateFrom) {
      values.push(parsed.dateFrom);
      movementConditions.push(
        `im.movement_date >= $${values.length}::DATE`,
      );
    }

    if (parsed.dateTo) {
      values.push(parsed.dateTo);
      movementConditions.push(
        `im.movement_date < ($${values.length}::DATE + INTERVAL '1 day')`,
      );
    }

    if (parsed.search) {
      values.push(`%${parsed.search}%`);
      productConditions.push(`
        (
          p.sku ILIKE $${values.length}
          OR p.product_name ILIKE $${values.length}
          OR c.category_name ILIKE $${values.length}
          OR s.supplier_name ILIKE $${values.length}
        )
      `);
    }

    if (categoryId) {
      values.push(categoryId);
      productConditions.push(
        `p.category_id = $${values.length}`,
      );
    }

    if (stockStatus === "OUT") {
      productConditions.push("p.current_stock = 0");
    } else if (stockStatus === "LOW") {
      productConditions.push(`
        p.current_stock > 0
        AND p.current_stock <= p.minimum_stock
      `);
    } else if (stockStatus === "AVAILABLE") {
      productConditions.push(
        "p.current_stock > p.minimum_stock",
      );
    }

    const movementWhereClause =
      movementConditions.length
        ? `WHERE ${movementConditions.join(" AND ")}`
        : "";
    const productWhereClause = `
      WHERE ${productConditions.join(" AND ")}
    `;

    const inboundPosition = values.length + 1;
    const outboundPosition = values.length + 2;

    const reportCte = `
      WITH movement_totals AS (
        SELECT
          im.product_id,
          COALESCE(
            SUM(im.quantity) FILTER (
              WHERE im.movement_type::TEXT =
                ANY($${inboundPosition}::TEXT[])
            ),
            0
          ) AS inbound_quantity,
          COALESCE(
            SUM(im.quantity) FILTER (
              WHERE im.movement_type::TEXT =
                ANY($${outboundPosition}::TEXT[])
            ),
            0
          ) AS outbound_quantity
        FROM app.inventory_movements im
        ${movementWhereClause}
        GROUP BY im.product_id
      ),
      report_rows AS (
        SELECT
          p.id,
          p.sku,
          p.product_name,
          p.unit,
          c.id AS category_id,
          c.category_code,
          c.category_name,
          s.id AS supplier_id,
          s.supplier_code,
          s.supplier_name,
          p.current_stock,
          p.minimum_stock,
          p.purchase_price,
          p.current_stock * p.purchase_price
            AS inventory_value,
          COALESCE(mt.inbound_quantity, 0)
            AS inbound_quantity,
          COALESCE(mt.outbound_quantity, 0)
            AS outbound_quantity,
          CASE
            WHEN p.current_stock = 0 THEN 'OUT'
            WHEN p.current_stock <= p.minimum_stock
              THEN 'LOW'
            ELSE 'AVAILABLE'
          END AS stock_status
        FROM app.products p
        JOIN app.categories c
          ON c.id = p.category_id
        JOIN app.suppliers s
          ON s.id = p.supplier_id
        LEFT JOIN movement_totals mt
          ON mt.product_id = p.id
        ${productWhereClause}
      )
    `;

    const reportValues = [
      ...values,
      INBOUND_MOVEMENT_TYPES,
      OUTBOUND_MOVEMENT_TYPES,
    ];

    const [summaryResult, countResult] =
      await Promise.all([
        pool.query(
          `${reportCte}
          SELECT
            COUNT(*)::INTEGER AS total_products,
            (COUNT(*) FILTER (
              WHERE stock_status = 'LOW'
            ))::INTEGER AS low_stock_products,
            (COUNT(*) FILTER (
              WHERE stock_status = 'OUT'
            ))::INTEGER AS out_of_stock_products,
            COALESCE(SUM(current_stock), 0)
              AS total_stock_units,
            COALESCE(SUM(inventory_value), 0)
              AS total_inventory_value,
            COALESCE(SUM(inbound_quantity), 0)
              AS inbound_quantity,
            COALESCE(SUM(outbound_quantity), 0)
              AS outbound_quantity
          FROM report_rows`,
          reportValues,
        ),
        pool.query(
          `${reportCte}
          SELECT COUNT(*)::INTEGER AS total
          FROM report_rows`,
          reportValues,
        ),
      ]);

    const trendConditions = [
      ...movementConditions,
      ...productConditions,
    ];
    const trendWhereClause = trendConditions.length
      ? `WHERE ${trendConditions.join(" AND ")}`
      : "";

    const trendResult = await pool.query(
      `
      SELECT
        TO_CHAR(
          DATE_TRUNC('month', im.movement_date),
          'YYYY-MM'
        ) AS period,
        COALESCE(
          SUM(im.quantity) FILTER (
            WHERE im.movement_type::TEXT =
              ANY($${inboundPosition}::TEXT[])
          ),
          0
        ) AS inbound_quantity,
        COALESCE(
          SUM(im.quantity) FILTER (
            WHERE im.movement_type::TEXT =
              ANY($${outboundPosition}::TEXT[])
          ),
          0
        ) AS outbound_quantity
      FROM app.inventory_movements im
      JOIN app.products p
        ON p.id = im.product_id
      JOIN app.categories c
        ON c.id = p.category_id
      JOIN app.suppliers s
        ON s.id = p.supplier_id
      ${trendWhereClause}
      GROUP BY DATE_TRUNC('month', im.movement_date)
      ORDER BY DATE_TRUNC('month', im.movement_date) ASC
      `,
      reportValues,
    );

    const total = countResult.rows[0].total;
    const rowsResult = await pool.query(
      `${reportCte}
      SELECT *
      FROM report_rows
      ORDER BY product_name ASC, sku ASC
      LIMIT $${reportValues.length + 1}
      OFFSET $${reportValues.length + 2}`,
      [
        ...reportValues,
        parsed.limit,
        parsed.offset,
      ],
    );

    sendReportResponse({
      res,
      message:
        "Inventory report retrieved successfully",
      filters: {
        search: parsed.search,
        category_id: categoryId,
        stock_status: stockStatus,
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
      "Error fetching inventory report:",
      error,
    );

    res.status(500).json({
      success: false,
      message: "Failed to retrieve inventory report",
    });
  }
};

module.exports = {
  getInventoryReport,
};
