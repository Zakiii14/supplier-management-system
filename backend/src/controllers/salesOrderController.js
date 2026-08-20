const pool = require("../config/database");

const getAllSalesOrders = async (req, res) => {
  try {
    const {
      search = "",
      status,
      customer_id,
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
      "DRAFT",
      "CONFIRMED",
      "PARTIALLY_DELIVERED",
      "DELIVERED",
      "CANCELLED",
    ];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sales order status",
      });
    }

    const conditions = [];
    const values = [];

    if (search.trim()) {
      values.push(`%${search.trim()}%`);

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
        `so.status::TEXT = $${values.length}`
      );
    }

    if (customer_id) {
      values.push(customer_id);
      conditions.push(
        `so.customer_id = $${values.length}`
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::INTEGER AS total
      FROM app.sales_orders so
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
        so.id,
        so.so_number,
        so.customer_id,
        c.customer_code,
        c.customer_name,
        so.order_date,
        so.requested_delivery_date,
        so.status,
        so.notes,
        so.created_by,
        so.created_at,
        so.updated_at,

        (
          SELECT COUNT(*)::INTEGER
          FROM app.sales_order_items soi
          WHERE soi.sales_order_id = so.id
        ) AS total_items,

        (
          SELECT COALESCE(
            SUM(
              soi.quantity * soi.unit_price
              - soi.discount_amount
            ),
            0
          )
          FROM app.sales_order_items soi
          WHERE soi.sales_order_id = so.id
        ) AS total_amount

      FROM app.sales_orders so

      JOIN app.customers c
        ON c.id = so.customer_id

      ${whereClause}

      ORDER BY so.created_at DESC

      LIMIT $${queryValues.length - 1}
      OFFSET $${queryValues.length}
      `,
      queryValues
    );

    const totalData = countResult.rows[0].total;

    res.status(200).json({
      success: true,
      message:
        "Sales orders retrieved successfully",
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
    console.error(
      "Error fetching sales orders:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve sales orders",
    });
  }
};

const getSalesOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const orderResult = await pool.query(
      `
      SELECT
        so.*,
        c.customer_code,
        c.customer_name,
        c.contact_person,
        c.phone,
        c.email,
        c.address,
        c.city,
        c.payment_terms_days,
        c.credit_limit

      FROM app.sales_orders so

      JOIN app.customers c
        ON c.id = so.customer_id

      WHERE so.id = $1
      `,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Sales order not found",
      });
    }

    const itemsResult = await pool.query(
      `
      SELECT
        soi.id,
        soi.product_id,
        p.sku,
        p.product_name,
        p.unit,
        p.current_stock,
        soi.quantity,
        soi.unit_price,
        soi.discount_amount,
        (
          soi.quantity * soi.unit_price
          - soi.discount_amount
        ) AS subtotal

      FROM app.sales_order_items soi

      JOIN app.products p
        ON p.id = soi.product_id

      WHERE soi.sales_order_id = $1

      ORDER BY p.product_name ASC
      `,
      [id]
    );

    const totalAmount = itemsResult.rows.reduce(
      (total, item) =>
        total + Number(item.subtotal),
      0
    );

    res.status(200).json({
      success: true,
      message:
        "Sales order retrieved successfully",
      data: {
        ...orderResult.rows[0],
        items: itemsResult.rows,
        total_amount: totalAmount,
      },
    });
  } catch (error) {
    console.error(
      "Error fetching sales order:",
      error
    );

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid sales order ID",
      });
    }

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve sales order",
    });
  }
};

const createSalesOrder = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      so_number,
      customer_id,
      order_date,
      requested_delivery_date,
      notes,
      created_by,
      items,
    } = req.body;

    if (!so_number || !customer_id) {
      return res.status(400).json({
        success: false,
        message:
          "so_number and customer_id are required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Sales order must contain at least one item",
      });
    }

    const productIds = items.map(
      (item) => item.product_id
    );

    if (
      new Set(productIds).size !== productIds.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Duplicate products are not allowed",
      });
    }

    await client.query("BEGIN");

    const customerResult = await client.query(
      `
      SELECT id
      FROM app.customers
      WHERE id = $1
        AND status = 'ACTIVE'
      `,
      [customer_id]
    );

    if (customerResult.rows.length === 0) {
      throw new Error(
        "Customer not found or inactive"
      );
    }

    const orderResult = await client.query(
      `
      INSERT INTO app.sales_orders (
        so_number,
        customer_id,
        order_date,
        requested_delivery_date,
        status,
        notes,
        created_by
      )
      VALUES (
        $1,
        $2,
        COALESCE($3::DATE, CURRENT_DATE),
        $4,
        'DRAFT',
        $5,
        $6
      )
      RETURNING *
      `,
      [
        so_number,
        customer_id,
        order_date || null,
        requested_delivery_date || null,
        notes || null,
        created_by || null,
      ]
    );

    const salesOrder = orderResult.rows[0];

    for (const item of items) {
      const {
        product_id,
        quantity,
        unit_price,
        discount_amount = 0,
      } = item;

      if (
        !product_id ||
        Number(quantity) <= 0
      ) {
        throw new Error(
          "Each item must have a valid product_id and quantity"
        );
      }

      const productResult = await client.query(
        `
        SELECT
          id,
          product_name,
          selling_price,
          current_stock,
          status
        FROM app.products
        WHERE id = $1
        `,
        [product_id]
      );

      if (productResult.rows.length === 0) {
        throw new Error(
          `Product not found: ${product_id}`
        );
      }

      const product = productResult.rows[0];

      if (product.status !== "ACTIVE") {
        throw new Error(
          `${product.product_name} is inactive`
        );
      }

      const finalUnitPrice =
        unit_price ?? product.selling_price;

      const grossAmount =
        Number(quantity) *
        Number(finalUnitPrice);

      if (Number(finalUnitPrice) < 0) {
        throw new Error(
          "Unit price cannot be negative"
        );
      }

      if (
        Number(discount_amount) < 0 ||
        Number(discount_amount) > grossAmount
      ) {
        throw new Error(
          `Invalid discount for ${product.product_name}`
        );
      }

      await client.query(
        `
        INSERT INTO app.sales_order_items (
          sales_order_id,
          product_id,
          quantity,
          unit_price,
          discount_amount
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          salesOrder.id,
          product_id,
          quantity,
          finalUnitPrice,
          discount_amount,
        ]
      );
    }

    await client.query("COMMIT");

    const itemsResult = await pool.query(
      `
      SELECT
        soi.id,
        soi.product_id,
        p.sku,
        p.product_name,
        soi.quantity,
        soi.unit_price,
        soi.discount_amount,
        (
          soi.quantity * soi.unit_price
          - soi.discount_amount
        ) AS subtotal
      FROM app.sales_order_items soi
      JOIN app.products p
        ON p.id = soi.product_id
      WHERE soi.sales_order_id = $1
      `,
      [salesOrder.id]
    );

    res.status(201).json({
      success: true,
      message:
        "Sales order created successfully",
      data: {
        ...salesOrder,
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Error creating sales order:",
      error
    );

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message:
          "Sales order number already exists",
      });
    }

    if (error.code === "23514") {
      return res.status(400).json({
        success: false,
        message:
          "Requested delivery date cannot be earlier than order date",
      });
    }

    res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to create sales order",
    });
  } finally {
    client.release();
  }
};

const updateSalesOrderStatus = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["CONFIRMED", "CANCELLED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Status can only be CONFIRMED or CANCELLED manually",
      });
    }

    await client.query("BEGIN");

    const orderResult = await client.query(
      `
      SELECT id, status
      FROM app.sales_orders
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (orderResult.rows.length === 0) {
      throw new Error("Sales order not found");
    }

    const currentStatus =
      orderResult.rows[0].status;

    if (
      status === "CONFIRMED" &&
      currentStatus !== "DRAFT"
    ) {
      throw new Error(
        "Only DRAFT sales orders can be confirmed"
      );
    }

    if (
      status === "CANCELLED" &&
      !["DRAFT", "CONFIRMED"].includes(
        currentStatus
      )
    ) {
      throw new Error(
        "This sales order cannot be cancelled"
      );
    }

    if (status === "CONFIRMED") {
      const itemsResult = await client.query(
        `
        SELECT
          soi.quantity,
          p.product_name,
          p.current_stock,
          p.status
        FROM app.sales_order_items soi
        JOIN app.products p
          ON p.id = soi.product_id
        WHERE soi.sales_order_id = $1
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
          Number(item.quantity) >
          Number(item.current_stock)
        ) {
          throw new Error(
            `Insufficient stock for ${item.product_name}. Available: ${item.current_stock}`
          );
        }
      }
    }

    const result = await client.query(
      `
      UPDATE app.sales_orders
      SET
        status = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [status, id]
    );

    await client.query("COMMIT");

    res.status(200).json({
      success: true,
      message:
        "Sales order status updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Error updating sales order status:",
      error
    );

    res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to update sales order status",
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getAllSalesOrders,
  getSalesOrderById,
  createSalesOrder,
  updateSalesOrderStatus,
};