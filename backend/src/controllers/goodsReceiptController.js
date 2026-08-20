const pool = require("../config/database");

const createGoodsReceipt = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
            receipt_number,
            purchase_order_id,
            notes,
            items,
          } = req.body;

          const receivedBy = req.user.id;

    // =========================
    // BASIC VALIDATION
    // =========================
    if (!receipt_number || !purchase_order_id) {
      return res.status(400).json({
        success: false,
        message:
          "receipt_number and purchase_order_id are required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Goods receipt must contain at least one item",
      });
    }

    // Jangan menerima PO item yang sama dua kali
    const poItemIds = items.map(
      (item) => item.purchase_order_item_id
    );

    if (new Set(poItemIds).size !== poItemIds.length) {
      return res.status(400).json({
        success: false,
        message:
          "Duplicate purchase order items are not allowed",
      });
    }

    await client.query("BEGIN");

    // =========================
    // CHECK PURCHASE ORDER
    // =========================
    const poResult = await client.query(
      `
      SELECT
        id,
        po_number,
        status
      FROM app.purchase_orders
      WHERE id = $1
      FOR UPDATE
      `,
      [purchase_order_id]
    );

    if (poResult.rows.length === 0) {
      throw new Error("Purchase order not found");
    }

    const purchaseOrder = poResult.rows[0];

    if (
      !["SUBMITTED", "PARTIALLY_RECEIVED"].includes(
        purchaseOrder.status
      )
    ) {
      throw new Error(
        "Purchase order must be SUBMITTED or PARTIALLY_RECEIVED"
      );
    }

    // =========================
    // CREATE GOODS RECEIPT
    // =========================
    const receiptResult = await client.query(
      `
      INSERT INTO app.goods_receipts (
        receipt_number,
        purchase_order_id,
        received_by,
        notes
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        receipt_number,
        purchase_order_id,
        receivedBy,
        notes || null,
      ]
    );

    const goodsReceipt = receiptResult.rows[0];

    // =========================
    // PROCESS ITEMS
    // =========================
    for (const item of items) {
      const {
        purchase_order_item_id,
        quantity_received,
        quantity_damaged = 0,
      } = item;

      if (
        !purchase_order_item_id ||
        Number(quantity_received) <= 0 ||
        Number(quantity_damaged) < 0
      ) {
        throw new Error(
          "Invalid goods receipt item"
        );
      }

      if (
        Number(quantity_damaged) >
        Number(quantity_received)
      ) {
        throw new Error(
          "Damaged quantity cannot exceed received quantity"
        );
      }

      // Lock PO item agar tidak terjadi penerimaan bersamaan
      const poItemResult = await client.query(
        `
        SELECT
          poi.id,
          poi.purchase_order_id,
          poi.product_id,
          poi.quantity,
          poi.received_quantity,
          p.product_name

        FROM app.purchase_order_items poi

        JOIN app.products p
          ON p.id = poi.product_id

        WHERE poi.id = $1
        FOR UPDATE OF poi
        `,
        [purchase_order_item_id]
      );

      if (poItemResult.rows.length === 0) {
        throw new Error(
          "Purchase order item not found"
        );
      }

      const poItem = poItemResult.rows[0];

      // Pastikan item memang milik PO tersebut
      if (
        poItem.purchase_order_id !== purchase_order_id
      ) {
        throw new Error(
          `${poItem.product_name} does not belong to this purchase order`
        );
      }

      const remainingQuantity =
        Number(poItem.quantity) -
        Number(poItem.received_quantity);

      if (
        Number(quantity_received) >
        remainingQuantity
      ) {
        throw new Error(
          `Received quantity for ${poItem.product_name} exceeds remaining PO quantity (${remainingQuantity})`
        );
      }

      // =========================
      // GOODS RECEIPT ITEM
      // =========================
      await client.query(
        `
        INSERT INTO app.goods_receipt_items (
          goods_receipt_id,
          purchase_order_item_id,
          product_id,
          quantity_received,
          quantity_damaged
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          goodsReceipt.id,
          poItem.id,
          poItem.product_id,
          quantity_received,
          quantity_damaged,
        ]
      );

      // =========================
      // UPDATE RECEIVED QUANTITY
      // =========================
      await client.query(
        `
        UPDATE app.purchase_order_items
        SET received_quantity =
          received_quantity + $1
        WHERE id = $2
        `,
        [
          quantity_received,
          poItem.id,
        ]
      );

      /*
       * Hanya barang kondisi baik yang masuk stok.
       *
       * Contoh:
       * received = 100
       * damaged  = 5
       *
       * stock masuk = 95
       */
      const stockQuantity =
        Number(quantity_received) -
        Number(quantity_damaged);

      if (stockQuantity > 0) {
        // =========================
        // INVENTORY LEDGER
        // =========================
        await client.query(
          `
          INSERT INTO app.inventory_movements (
            product_id,
            movement_type,
            quantity,
            reference_type,
            reference_id,
            notes,
            created_by
          )
          VALUES (
            $1,
            'PURCHASE_RECEIPT',
            $2,
            'GOODS_RECEIPT',
            $3,
            $4,
            $5
          )
          `,
          [
            poItem.product_id,
            stockQuantity,
            goodsReceipt.id,
            `Goods receipt ${receipt_number}`,
            receivedBy,
          ]
        );

        // =========================
        // UPDATE CURRENT STOCK
        // =========================
        await client.query(
          `
          UPDATE app.products
          SET current_stock =
            current_stock + $1
          WHERE id = $2
          `,
          [
            stockQuantity,
            poItem.product_id,
          ]
        );
      }
    }

    // =========================
    // DETERMINE PO STATUS
    // =========================
    const remainingResult = await client.query(
      `
      SELECT COUNT(*)::INTEGER AS remaining

      FROM app.purchase_order_items

      WHERE purchase_order_id = $1
      AND received_quantity < quantity
      `,
      [purchase_order_id]
    );

    const remaining =
      remainingResult.rows[0].remaining;

    const newStatus =
      remaining === 0
        ? "RECEIVED"
        : "PARTIALLY_RECEIVED";

    await client.query(
      `
      UPDATE app.purchase_orders
      SET status = $1
      WHERE id = $2
      `,
      [
        newStatus,
        purchase_order_id,
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message:
        "Goods receipt created successfully",
      data: {
        ...goodsReceipt,
        purchase_order_status: newStatus,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Error creating goods receipt:",
      error
    );

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message:
          "Receipt number already exists",
      });
    }

    res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to create goods receipt",
    });
  } finally {
    client.release();
  }
};

const getAllGoodsReceipts = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        gr.*,
        po.po_number,
        po.status AS purchase_order_status,
        s.supplier_code,
        s.supplier_name,

        (
          SELECT COUNT(*)::INTEGER
          FROM app.goods_receipt_items gri
          WHERE gri.goods_receipt_id = gr.id
        ) AS total_items,

        (
          SELECT COALESCE(SUM(gri.quantity_received), 0)
          FROM app.goods_receipt_items gri
          WHERE gri.goods_receipt_id = gr.id
        ) AS total_quantity_received,

        (
          SELECT COALESCE(SUM(gri.quantity_damaged), 0)
          FROM app.goods_receipt_items gri
          WHERE gri.goods_receipt_id = gr.id
        ) AS total_quantity_damaged

      FROM app.goods_receipts gr

      JOIN app.purchase_orders po
        ON po.id = gr.purchase_order_id

      JOIN app.suppliers s
        ON s.id = po.supplier_id

      ORDER BY gr.created_at DESC
    `);

    res.status(200).json({
      success: true,
      message: "Goods receipts retrieved successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching goods receipts:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve goods receipts",
    });
  }
};

const getGoodsReceiptById = async (req, res) => {
  try {
    const { id } = req.params;

    const receiptResult = await pool.query(
      `
      SELECT
        gr.*,
        po.po_number,
        po.status AS purchase_order_status,
        s.id AS supplier_id,
        s.supplier_code,
        s.supplier_name

      FROM app.goods_receipts gr

      JOIN app.purchase_orders po
        ON po.id = gr.purchase_order_id

      JOIN app.suppliers s
        ON s.id = po.supplier_id

      WHERE gr.id = $1
      `,
      [id]
    );

    if (receiptResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Goods receipt not found",
      });
    }

    const itemsResult = await pool.query(
      `
      SELECT
        gri.id,
        gri.purchase_order_item_id,
        gri.product_id,
        p.sku,
        p.product_name,
        p.unit,
        gri.quantity_received,
        gri.quantity_damaged,
        (
          gri.quantity_received - gri.quantity_damaged
        ) AS quantity_added_to_stock,
        poi.quantity AS ordered_quantity,
        poi.received_quantity AS total_received_quantity

      FROM app.goods_receipt_items gri

      JOIN app.products p
        ON p.id = gri.product_id

      JOIN app.purchase_order_items poi
        ON poi.id = gri.purchase_order_item_id

      WHERE gri.goods_receipt_id = $1

      ORDER BY p.product_name ASC
      `,
      [id]
    );

    res.status(200).json({
      success: true,
      message: "Goods receipt retrieved successfully",
      data: {
        ...receiptResult.rows[0],
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    console.error("Error fetching goods receipt:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve goods receipt",
    });
  }
};

module.exports = {
  getAllGoodsReceipts,
  getGoodsReceiptById,
  createGoodsReceipt,
};