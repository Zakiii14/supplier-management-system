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
            so.opname_number,
            pr.return_number,
            sr.return_number,
            isi.inspection_number,
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
      LEFT JOIN app.stock_opnames so
        ON im.reference_type = 'STOCK_OPNAME'
        AND so.id = im.reference_id
      LEFT JOIN app.purchase_returns pr
        ON im.reference_type = 'PURCHASE_RETURN'
        AND pr.id = im.reference_id
      LEFT JOIN app.sales_returns sr
        ON im.reference_type = 'SALES_RETURN'
        AND sr.id = im.reference_id
      LEFT JOIN app.inventory_stock_inspections isi
        ON im.reference_type = 'STOCK_INSPECTION'
        AND isi.id = im.reference_id

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
        im.stock_bucket,
        im.reference_type,
        COALESCE(
          d.delivery_number,
          gr.receipt_number,
          so.opname_number,
          pr.return_number,
          sr.return_number,
          isi.inspection_number
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
      LEFT JOIN app.stock_opnames so
        ON im.reference_type = 'STOCK_OPNAME'
        AND so.id = im.reference_id
      LEFT JOIN app.purchase_returns pr
        ON im.reference_type = 'PURCHASE_RETURN'
        AND pr.id = im.reference_id
      LEFT JOIN app.sales_returns sr
        ON im.reference_type = 'SALES_RETURN'
        AND sr.id = im.reference_id
      LEFT JOIN app.inventory_stock_inspections isi
        ON im.reference_type = 'STOCK_INSPECTION'
        AND isi.id = im.reference_id

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
        im.stock_bucket,
        im.reference_type,
        COALESCE(
          d.delivery_number,
          gr.receipt_number,
          so.opname_number,
          pr.return_number,
          sr.return_number,
          isi.inspection_number
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
      LEFT JOIN app.stock_opnames so
        ON im.reference_type = 'STOCK_OPNAME'
        AND so.id = im.reference_id
      LEFT JOIN app.purchase_returns pr
        ON im.reference_type = 'PURCHASE_RETURN'
        AND pr.id = im.reference_id
      LEFT JOIN app.sales_returns sr
        ON im.reference_type = 'SALES_RETURN'
        AND sr.id = im.reference_id
      LEFT JOIN app.inventory_stock_inspections isi
        ON im.reference_type = 'STOCK_INSPECTION'
        AND isi.id = im.reference_id

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

const getQuarantineStocks = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id,p.sku,p.product_name,p.unit,p.quarantine_stock
       FROM app.products p
       WHERE p.quarantine_stock > 0
       ORDER BY p.product_name ASC`,
    );

    return res.status(200).json({
      success: true,
      message: "Quarantine stocks retrieved successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching quarantine stocks:", error);
    return res.status(500).json({
      success: false,
      message: "Stok karantina gagal dimuat",
    });
  }
};

const createStockInspection = async (req, res) => {
  const client = await pool.connect();
  try {
    const productId = typeof req.body.product_id === "string" ? req.body.product_id.trim() : "";
    const targetBucket = typeof req.body.target_bucket === "string" ? req.body.target_bucket.trim().toUpperCase() : "";
    const inspectionDate = typeof req.body.inspection_date === "string" ? req.body.inspection_date.trim() : "";
    const notes = typeof req.body.notes === "string" ? req.body.notes.trim().slice(0, 1000) : "";
    const quantity = Number(req.body.quantity);

    if (!productId || !["AVAILABLE", "DAMAGED"].includes(targetBucket)) {
      return res.status(400).json({ success: false, message: "Produk dan hasil pemeriksaan harus dipilih" });
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 1e-8) {
      return res.status(400).json({ success: false, message: "Kuantitas pemeriksaan tidak valid" });
    }
    if (inspectionDate && !/^\d{4}-\d{2}-\d{2}$/.test(inspectionDate)) {
      return res.status(400).json({ success: false, message: "Tanggal pemeriksaan tidak valid" });
    }

    await client.query("BEGIN");
    const productResult = await client.query(
      `SELECT id,sku,product_name,unit,quarantine_stock
       FROM app.products WHERE id=$1 FOR UPDATE`,
      [productId],
    );
    if (!productResult.rows.length) {
      const error = new Error("Produk tidak ditemukan"); error.statusCode = 404; throw error;
    }
    const product = productResult.rows[0];
    if (quantity > Number(product.quarantine_stock)) {
      const error = new Error(`Kuantitas melebihi stok karantina (${Number(product.quarantine_stock)})`); error.statusCode = 409; throw error;
    }

    const inspectionResult = await client.query(
      `INSERT INTO app.inventory_stock_inspections(
         inspection_number,product_id,target_bucket,quantity,inspection_date,notes,created_by
       ) VALUES(
         CONCAT('INS-',TO_CHAR(COALESCE($4::date,CURRENT_DATE),'YYYY'),'-',UPPER(LEFT(REPLACE(gen_random_uuid()::text,'-',''),8))),
         $1,$2,$3,COALESCE($4::date,CURRENT_DATE),$5,$6
       ) RETURNING *`,
      [productId,targetBucket,quantity,inspectionDate || null,notes || null,req.user.id],
    );
    const inspection = inspectionResult.rows[0];

    if (targetBucket === "AVAILABLE") {
      await client.query(
        `UPDATE app.products
         SET quarantine_stock=quarantine_stock-$1,current_stock=current_stock+$1,updated_at=NOW()
         WHERE id=$2`,
        [quantity,productId],
      );
    } else {
      await client.query(
        `UPDATE app.products
         SET quarantine_stock=quarantine_stock-$1,damaged_stock=damaged_stock+$1,updated_at=NOW()
         WHERE id=$2`,
        [quantity,productId],
      );
    }

    await client.query(
      `INSERT INTO app.inventory_movements(
         product_id,movement_type,quantity,reference_type,reference_id,stock_bucket,notes,created_by
       ) VALUES
         ($1,'ADJUSTMENT_OUT',$2,'STOCK_INSPECTION',$3,'QUARANTINE',$4,$7),
         ($1,'ADJUSTMENT_IN',$2,'STOCK_INSPECTION',$3,$5,$6,$7)`,
      [
        productId,
        quantity,
        inspection.id,
        `Pemeriksaan ${inspection.inspection_number}: keluar dari stok karantina`,
        targetBucket,
        `Pemeriksaan ${inspection.inspection_number}: masuk ke ${targetBucket === "AVAILABLE" ? "stok tersedia" : "stok rusak"}`,
        req.user.id,
      ],
    );

    await client.query("COMMIT");
    return res.status(201).json({
      success: true,
      message: targetBucket === "AVAILABLE" ? "Barang dipindahkan ke stok tersedia" : "Barang dipindahkan ke stok rusak",
      data: { ...inspection, sku: product.sku, product_name: product.product_name, unit: product.unit },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating stock inspection:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Pemeriksaan stok gagal disimpan",
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getAllInventoryMovements,
  getInventoryMovementById,
  getQuarantineStocks,
  createStockInspection,
};
