const pool = require("../config/database");
const {
  parseDateRange,
} = require("../utils/dateRange");

const getAllInventoryMovements = async (req, res) => {
  try {
    const {
      search = "",
      movement_type,
      product_id,
      date_from = "",
      date_to = "",
      page = 1,
      limit = 10,
    } = req.query;

    const parsedPage = Math.max(Number(page) || 1, 1);
    const parsedLimit = Math.min(
      Math.max(Number(limit) || 10, 1),
      100
    );
    const offset = (parsedPage - 1) * parsedLimit;

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

    if (search.trim()) {
      values.push(`%${search.trim()}%`);

      conditions.push(`
        (
          p.sku ILIKE $${values.length}
          OR p.product_name ILIKE $${values.length}
          OR COALESCE(im.reference_type::TEXT, '')
            ILIKE $${values.length}
          OR COALESCE(
            d.delivery_number,
            gr.receipt_number,
            ''
          ) ILIKE $${values.length}
          OR CONCAT(
            'MOV-',
            UPPER(LEFT(MD5(im.id::TEXT), 8))
          ) ILIKE $${values.length}
          OR COALESCE(im.notes, '')
            ILIKE $${values.length}
          OR COALESCE(u.full_name, '')
            ILIKE $${values.length}
          OR COALESCE(u.username, '')
            ILIKE $${values.length}
          OR (
            im.created_by IS NULL
            AND 'Sistem' ILIKE $${values.length}
          )
        )
      `);
    }

    if (movement_type) {
      values.push(movement_type);

      conditions.push(
        `im.movement_type::TEXT = $${values.length}`
      );
    }

    if (product_id) {
      values.push(product_id);

      conditions.push(
        `im.product_id = $${values.length}`
      );
    }

    if (dateFrom) {
      values.push(dateFrom);

      conditions.push(
        `im.movement_date >= $${values.length}::DATE`
      );
    }

    if (dateTo) {
      values.push(dateTo);

      conditions.push(
        `im.movement_date < ($${values.length}::DATE + INTERVAL '1 day')`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::INTEGER AS total

      FROM app.inventory_movements im

      JOIN app.products p
        ON p.id = im.product_id

      LEFT JOIN app.users u
        ON u.id = im.created_by
      LEFT JOIN app.deliveries d
        ON im.reference_type = 'DELIVERY'
        AND d.id = im.reference_id
      LEFT JOIN app.goods_receipts gr
        ON im.reference_type = 'GOODS_RECEIPT'
        AND gr.id = im.reference_id

      ${whereClause}
      `,
      values
    );

    const queryValues = [
      ...values,
      parsedLimit,
      offset,
    ];

    const result = await pool.query(
      `
      SELECT
        im.id,
        CONCAT(
          'MOV-',
          UPPER(LEFT(MD5(im.id::TEXT), 8))
        ) AS movement_number,
        im.product_id,
        p.sku,
        p.product_name,
        p.unit,
        im.movement_type,
        im.quantity,
        im.reference_type,
        COALESCE(
          d.delivery_number,
          gr.receipt_number
        ) AS reference_number,
        im.notes,
        im.created_by,
        u.full_name AS created_by_name,
        im.movement_date

      FROM app.inventory_movements im

      JOIN app.products p
        ON p.id = im.product_id
      LEFT JOIN app.users u
        ON u.id = im.created_by
      LEFT JOIN app.deliveries d
        ON im.reference_type = 'DELIVERY'
        AND d.id = im.reference_id
      LEFT JOIN app.goods_receipts gr
        ON im.reference_type = 'GOODS_RECEIPT'
        AND gr.id = im.reference_id

      ${whereClause}

      ORDER BY im.movement_date DESC

      LIMIT $${queryValues.length - 1}
      OFFSET $${queryValues.length}
      `,
      queryValues
    );

    const totalData = countResult.rows[0].total;
    const totalPages = Math.ceil(
      totalData / parsedLimit
    );

    res.status(200).json({
      success: true,
      message:
        "Inventory movements retrieved successfully",
      data: result.rows,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total_data: totalData,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    console.error(
      "Error fetching inventory movements:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve inventory movements",
    });
  }
};

const getInventoryMovementById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        im.id,
        CONCAT(
          'MOV-',
          UPPER(LEFT(MD5(im.id::TEXT), 8))
        ) AS movement_number,
        im.product_id,
        p.sku,
        p.product_name,
        p.unit,
        im.movement_type,
        im.quantity,
        im.reference_type,
        COALESCE(
          d.delivery_number,
          gr.receipt_number
        ) AS reference_number,
        im.notes,
        im.created_by,
        u.full_name AS created_by_name,
        im.movement_date

      FROM app.inventory_movements im

      JOIN app.products p
        ON p.id = im.product_id
      LEFT JOIN app.users u
        ON u.id = im.created_by
      LEFT JOIN app.deliveries d
        ON im.reference_type = 'DELIVERY'
        AND d.id = im.reference_id
      LEFT JOIN app.goods_receipts gr
        ON im.reference_type = 'GOODS_RECEIPT'
        AND gr.id = im.reference_id

      WHERE im.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Inventory movement not found",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Inventory movement retrieved successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error(
      "Error fetching inventory movement:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve inventory movement",
    });
  }
};

module.exports = {
  getAllInventoryMovements,
  getInventoryMovementById,
};
