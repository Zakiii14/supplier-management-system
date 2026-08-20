const pool = require("../config/database");

const getAllDeliveries = async (req, res) => {
  try {
    const {
      search = "",
      status,
      sales_order_id,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(
      Math.max(Number(limit) || 10, 1),
      100
    );
    const offset = (pageNumber - 1) * limitNumber;

    const allowedStatuses = [
      "PENDING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid delivery status",
      });
    }

    const conditions = [];
    const values = [];

    if (search.trim()) {
      values.push(`%${search.trim()}%`);

      conditions.push(`
        (
          d.delivery_number ILIKE $${values.length}
          OR so.so_number ILIKE $${values.length}
          OR c.customer_name ILIKE $${values.length}
          OR COALESCE(d.recipient_name, '')
            ILIKE $${values.length}
        )
      `);
    }

    if (status) {
      values.push(status);
      conditions.push(
        `d.status::TEXT = $${values.length}`
      );
    }

    if (sales_order_id) {
      values.push(sales_order_id);
      conditions.push(
        `d.sales_order_id = $${values.length}`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::INTEGER AS total
      FROM app.deliveries d
      JOIN app.sales_orders so
        ON so.id = d.sales_order_id
      JOIN app.customers c
        ON c.id = so.customer_id
      ${whereClause}
      `,
      values
    );

    const queryValues = [
      ...values,
      limitNumber,
      offset,
    ];

    const result = await pool.query(
      `
      SELECT
        d.id,
        d.delivery_number,
        d.sales_order_id,
        so.so_number,
        c.customer_code,
        c.customer_name,
        d.delivery_date,
        d.status,
        d.recipient_name,
        d.address,
        d.delivered_at,
        d.notes,
        d.created_by,
        d.created_at,

        (
          SELECT COUNT(*)::INTEGER
          FROM app.delivery_items di
          WHERE di.delivery_id = d.id
        ) AS total_items,

        (
          SELECT COALESCE(
            SUM(di.quantity_delivered),
            0
          )
          FROM app.delivery_items di
          WHERE di.delivery_id = d.id
        ) AS total_quantity

      FROM app.deliveries d

      JOIN app.sales_orders so
        ON so.id = d.sales_order_id

      JOIN app.customers c
        ON c.id = so.customer_id

      ${whereClause}

      ORDER BY d.created_at DESC

      LIMIT $${queryValues.length - 1}
      OFFSET $${queryValues.length}
      `,
      queryValues
    );

    const totalData = countResult.rows[0].total;

    res.status(200).json({
      success: true,
      message: "Deliveries retrieved successfully",
      data: result.rows,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total_data: totalData,
        total_pages: Math.ceil(
          totalData / limitNumber
        ),
      },
    });
  } catch (error) {
    console.error("Error fetching deliveries:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve deliveries",
    });
  }
};

const getDeliveryById = async (req, res) => {
  try {
    const { id } = req.params;

    const deliveryResult = await pool.query(
      `
      SELECT
        d.*,
        so.so_number,
        so.status AS sales_order_status,
        c.customer_code,
        c.customer_name,
        c.contact_person,
        c.phone,
        c.email,
        c.city

      FROM app.deliveries d

      JOIN app.sales_orders so
        ON so.id = d.sales_order_id

      JOIN app.customers c
        ON c.id = so.customer_id

      WHERE d.id = $1
      `,
      [id]
    );

    if (deliveryResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Delivery not found",
      });
    }

    const itemsResult = await pool.query(
      `
      SELECT
        di.id,
        di.sales_order_item_id,
        di.product_id,
        p.sku,
        p.product_name,
        p.unit,
        p.current_stock,
        soi.quantity AS ordered_quantity,
        di.quantity_delivered

      FROM app.delivery_items di

      JOIN app.sales_order_items soi
        ON soi.id = di.sales_order_item_id

      JOIN app.products p
        ON p.id = di.product_id

      WHERE di.delivery_id = $1

      ORDER BY p.product_name ASC
      `,
      [id]
    );

    res.status(200).json({
      success: true,
      message: "Delivery retrieved successfully",
      data: {
        ...deliveryResult.rows[0],
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    console.error("Error fetching delivery:", error);

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid delivery ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve delivery",
    });
  }
};

const createDelivery = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
  delivery_number,
  sales_order_id,
  delivery_date,
  recipient_name,
  address,
  notes,
  items,
} = req.body;

const createdBy = req.user.id;

    if (!delivery_number || !sales_order_id) {
      return res.status(400).json({
        success: false,
        message:
          "delivery_number and sales_order_id are required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Delivery must contain at least one item",
      });
    }

    const salesOrderItemIds = items.map(
      (item) => item.sales_order_item_id
    );

    if (
      new Set(salesOrderItemIds).size !==
      salesOrderItemIds.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Duplicate sales order items are not allowed",
      });
    }

    await client.query("BEGIN");

    const orderResult = await client.query(
      `
      SELECT
        id,
        so_number,
        status,
        customer_id
      FROM app.sales_orders
      WHERE id = $1
      FOR UPDATE
      `,
      [sales_order_id]
    );

    if (orderResult.rows.length === 0) {
      throw new Error("Sales order not found");
    }

    const salesOrder = orderResult.rows[0];

    if (
      ![
        "CONFIRMED",
        "PARTIALLY_DELIVERED",
      ].includes(salesOrder.status)
    ) {
      throw new Error(
        "Sales order must be CONFIRMED or PARTIALLY_DELIVERED"
      );
    }

    const deliveryResult = await client.query(
      `
      INSERT INTO app.deliveries (
        delivery_number,
        sales_order_id,
        delivery_date,
        status,
        recipient_name,
        address,
        notes,
        created_by
      )
      VALUES (
        $1,
        $2,
        COALESCE($3::DATE, CURRENT_DATE),
        'PENDING',
        $4,
        $5,
        $6,
        $7
      )
      RETURNING *
      `,
      [
        delivery_number,
        sales_order_id,
        delivery_date || null,
        recipient_name || null,
        address || null,
        notes || null,
        createdBy,
      ]
    );

    const delivery = deliveryResult.rows[0];

    for (const item of items) {
      const {
        sales_order_item_id,
        quantity_delivered,
      } = item;

      if (
        !sales_order_item_id ||
        Number(quantity_delivered) <= 0
      ) {
        throw new Error(
          "Invalid delivery item"
        );
      }

      const orderItemResult = await client.query(
        `
        SELECT
          soi.id,
          soi.sales_order_id,
          soi.product_id,
          soi.quantity,
          p.product_name,
          p.current_stock

        FROM app.sales_order_items soi

        JOIN app.products p
          ON p.id = soi.product_id

        WHERE soi.id = $1

        FOR UPDATE OF soi
        `,
        [sales_order_item_id]
      );

      if (orderItemResult.rows.length === 0) {
        throw new Error(
          "Sales order item not found"
        );
      }

      const orderItem = orderItemResult.rows[0];

      if (
        orderItem.sales_order_id !== sales_order_id
      ) {
        throw new Error(
          `${orderItem.product_name} does not belong to this sales order`
        );
      }

      const existingResult = await client.query(
        `
        SELECT COALESCE(
          SUM(di.quantity_delivered),
          0
        ) AS total_reserved

        FROM app.delivery_items di

        JOIN app.deliveries d
          ON d.id = di.delivery_id

        WHERE di.sales_order_item_id = $1
          AND d.status <> 'CANCELLED'
        `,
        [sales_order_item_id]
      );

      const totalReserved = Number(
        existingResult.rows[0].total_reserved
      );

      const remainingQuantity =
        Number(orderItem.quantity) -
        totalReserved;

      if (
        Number(quantity_delivered) >
        remainingQuantity
      ) {
        throw new Error(
          `Delivery quantity for ${orderItem.product_name} exceeds remaining quantity (${remainingQuantity})`
        );
      }

      await client.query(
        `
        INSERT INTO app.delivery_items (
          delivery_id,
          sales_order_item_id,
          product_id,
          quantity_delivered
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
          delivery.id,
          orderItem.id,
          orderItem.product_id,
          quantity_delivered,
        ]
      );
    }

    await client.query("COMMIT");

    const itemsResult = await pool.query(
      `
      SELECT
        di.id,
        di.sales_order_item_id,
        di.product_id,
        p.sku,
        p.product_name,
        di.quantity_delivered
      FROM app.delivery_items di
      JOIN app.products p
        ON p.id = di.product_id
      WHERE di.delivery_id = $1
      `,
      [delivery.id]
    );

    res.status(201).json({
      success: true,
      message: "Delivery created successfully",
      data: {
        ...delivery,
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Error creating delivery:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message:
          "Delivery number already exists",
      });
    }

    res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to create delivery",
    });
  } finally {
    client.release();
  }
};

const updateDeliveryStatus = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Status must be SHIPPED, DELIVERED, or CANCELLED",
      });
    }

    await client.query("BEGIN");

    const deliveryResult = await client.query(
      `
      SELECT
        id,
        delivery_number,
        sales_order_id,
        status,
        created_by
      FROM app.deliveries
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (deliveryResult.rows.length === 0) {
      throw new Error("Delivery not found");
    }

    const delivery = deliveryResult.rows[0];

    const validTransitions = {
      PENDING: ["SHIPPED", "CANCELLED"],
      SHIPPED: ["DELIVERED"],
      DELIVERED: [],
      CANCELLED: [],
    };

    if (
      !validTransitions[delivery.status].includes(
        status
      )
    ) {
      throw new Error(
        `Delivery status cannot change from ${delivery.status} to ${status}`
      );
    }

    let salesOrderStatus = null;

    // =====================================
    // PENDING -> SHIPPED
    // Kurangi stok dan buat inventory ledger
    // =====================================
    if (status === "SHIPPED") {
      const itemsResult = await client.query(
        `
        SELECT
          di.product_id,
          di.quantity_delivered,
          p.product_name,
          p.current_stock,
          p.status

        FROM app.delivery_items di

        JOIN app.products p
          ON p.id = di.product_id

        WHERE di.delivery_id = $1

        FOR UPDATE OF p
        `,
        [id]
      );

      for (const item of itemsResult.rows) {
        if (item.status !== "ACTIVE") {
          throw new Error(
            `${item.product_name} is inactive`
          );
        }

        if (
          Number(item.quantity_delivered) >
          Number(item.current_stock)
        ) {
          throw new Error(
            `Insufficient stock for ${item.product_name}. Available: ${item.current_stock}`
          );
        }

        await client.query(
          `
          UPDATE app.products
          SET current_stock =
            current_stock - $1
          WHERE id = $2
          `,
          [
            item.quantity_delivered,
            item.product_id,
          ]
        );

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
            'SALES_ISSUE',
            $2,
            'DELIVERY',
            $3,
            $4,
            $5
          )
          `,
          [
            item.product_id,
            item.quantity_delivered,
            delivery.id,
            `Delivery ${delivery.delivery_number}`,
            delivery.created_by,
          ]
        );
      }

      await client.query(
        `
        UPDATE app.deliveries
        SET status = 'SHIPPED'
        WHERE id = $1
        `,
        [id]
      );
    }

    // =====================================
    // SHIPPED -> DELIVERED
    // Perbarui status Sales Order
    // =====================================
    if (status === "DELIVERED") {
      await client.query(
        `
        UPDATE app.deliveries
        SET
          status = 'DELIVERED',
          delivered_at = NOW()
        WHERE id = $1
        `,
        [id]
      );

      const remainingResult = await client.query(
        `
        SELECT COUNT(*)::INTEGER AS remaining

        FROM app.sales_order_items soi

        WHERE soi.sales_order_id = $1

          AND COALESCE(
            (
              SELECT SUM(
                di.quantity_delivered
              )

              FROM app.delivery_items di

              JOIN app.deliveries d
                ON d.id = di.delivery_id

              WHERE
                di.sales_order_item_id = soi.id
                AND d.status = 'DELIVERED'
            ),
            0
          ) < soi.quantity
        `,
        [delivery.sales_order_id]
      );

      const remaining =
        remainingResult.rows[0].remaining;

      salesOrderStatus =
        remaining === 0
          ? "DELIVERED"
          : "PARTIALLY_DELIVERED";

      await client.query(
        `
        UPDATE app.sales_orders
        SET
          status = $1,
          updated_at = NOW()
        WHERE id = $2
        `,
        [
          salesOrderStatus,
          delivery.sales_order_id,
        ]
      );
    }

    // =====================================
    // PENDING -> CANCELLED
    // Belum ada stok yang perlu dikembalikan
    // =====================================
    if (status === "CANCELLED") {
      await client.query(
        `
        UPDATE app.deliveries
        SET status = 'CANCELLED'
        WHERE id = $1
        `,
        [id]
      );
    }

    const updatedResult = await client.query(
      `
      SELECT *
      FROM app.deliveries
      WHERE id = $1
      `,
      [id]
    );

    await client.query("COMMIT");

    res.status(200).json({
      success: true,
      message:
        "Delivery status updated successfully",
      data: {
        ...updatedResult.rows[0],
        sales_order_status: salesOrderStatus,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Error updating delivery status:",
      error
    );

    res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to update delivery status",
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getAllDeliveries,
  getDeliveryById,
  createDelivery,
  updateDeliveryStatus,
};