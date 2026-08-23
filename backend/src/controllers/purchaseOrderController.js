const pool = require("../config/database");
const getAllPurchaseOrders = async (req, res) => {
  try {
    const {
      search = "",
      status = "",
      page = "1",
      limit = "10",
    } = req.query;

    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

    if (
      !Number.isInteger(parsedPage) ||
      !Number.isInteger(parsedLimit) ||
      parsedPage < 1 ||
      parsedLimit < 1 ||
      parsedLimit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    const allowedStatuses = [
      "DRAFT",
      "SUBMITTED",
      "PARTIALLY_RECEIVED",
      "RECEIVED",
      "CANCELLED",
    ];

    const normalizedStatus =
      typeof status === "string"
        ? status.trim().toUpperCase()
        : "";

    if (
      normalizedStatus &&
      !allowedStatuses.includes(normalizedStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase order status",
      });
    }

    const normalizedSearch =
      typeof search === "string"
        ? search.trim()
        : "";

    const conditions = [];
    const values = [];

    if (normalizedSearch) {
      values.push(`%${normalizedSearch}%`);

      conditions.push(`
        (
          po.po_number ILIKE $${values.length}
          OR s.supplier_code ILIKE $${values.length}
          OR s.supplier_name ILIKE $${values.length}
          OR COALESCE(po.notes, '') ILIKE $${values.length}
        )
      `);
    }

    if (normalizedStatus) {
      values.push(normalizedStatus);

      conditions.push(
        `po.status = $${values.length}`,
      );
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countResult = await pool.query(
      `
      SELECT COUNT(*)::INTEGER AS total
      FROM app.purchase_orders po
      JOIN app.suppliers s
        ON s.id = po.supplier_id
      ${whereClause}
      `,
      values,
    );

    const total = countResult.rows[0].total;
    const totalPages =
      total === 0
        ? 0
        : Math.ceil(total / parsedLimit);

    const offset =
      (parsedPage - 1) * parsedLimit;

    const listValues = [
      ...values,
      parsedLimit,
      offset,
    ];

    const limitPosition = values.length + 1;
    const offsetPosition = values.length + 2;

    const result = await pool.query(
      `
      SELECT
        po.id,
        po.po_number,
        po.order_date,
        po.expected_date,
        po.status,
        po.notes,
        po.created_by,
        po.created_at,
        po.updated_at,
        s.id AS supplier_id,
        s.supplier_code,
        s.supplier_name,
        COALESCE(summary.total_amount, 0)
          AS total_amount,
        COALESCE(summary.total_items, 0)
          AS total_items
      FROM app.purchase_orders po
      JOIN app.suppliers s
        ON s.id = po.supplier_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(
            SUM(
              poi.quantity * poi.unit_price
            ),
            0
          ) AS total_amount,
          COUNT(poi.id)::INTEGER
            AS total_items
        FROM app.purchase_order_items poi
        WHERE poi.purchase_order_id = po.id
      ) summary ON TRUE
      ${whereClause}
      ORDER BY po.created_at DESC
      LIMIT $${limitPosition}
      OFFSET $${offsetPosition}
      `,
      listValues,
    );

    res.status(200).json({
      success: true,
      message:
        "Purchase orders retrieved successfully",
      data: result.rows,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    console.error(
      "Error fetching purchase orders:",
      error,
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve purchase orders",
    });
  }
};
const getPurchaseOrderById = async (req, res) => {
	try {
		const {
			id
		} = req.params;
		const poResult = await pool.query(`
      SELECT
        po.id,
        po.po_number,
        po.order_date,
        po.expected_date,
        po.status,
        po.notes,
		po.created_by,
        po.created_at,
        po.updated_at,

        s.id AS supplier_id,
        s.supplier_code,
        s.supplier_name

      FROM app.purchase_orders po

      JOIN app.suppliers s
        ON s.id = po.supplier_id

      WHERE po.id = $1
      `,
			[id]);
		if (poResult.rows.length === 0) {
			return res.status(404).json({
				success: false,
				message: "Purchase order not found",
			});
		}
		const itemsResult = await pool.query(`
      SELECT
        poi.id,
        poi.product_id,
        p.sku,
        p.product_name,
        p.unit,
        poi.quantity,
        poi.unit_price,
        poi.received_quantity,
        (poi.quantity * poi.unit_price) AS subtotal

      FROM app.purchase_order_items poi

      JOIN app.products p
        ON p.id = poi.product_id

      WHERE poi.purchase_order_id = $1

      ORDER BY p.product_name ASC
      `,
			[id]);
		const totalAmount = itemsResult.rows.reduce(
			(total, item) => total + Number(item.subtotal), 0);
		res.status(200).json({
			success: true,
			message: "Purchase order retrieved successfully",
			data: {
				...poResult.rows[0],
				items: itemsResult.rows,
				total_amount: totalAmount,
			},
		});
	} catch (error) {
		console.error("Error fetching purchase order:", error);
		res.status(500).json({
			success: false,
			message: "Failed to retrieve purchase order",
		});
	}
};
const createPurchaseOrder = async (req, res) => {
	const client = await pool.connect();
	try {
		const {
			po_number,
			supplier_id,
			order_date,
			expected_date,
			notes,
			items,
		} = req.body;
		const createdBy = req.user.id;
		if (!po_number || !supplier_id) {
			return res.status(400).json({
				success: false,
				message: "po_number and supplier_id are required",
			});
		}
		if (!Array.isArray(items) || items.length === 0) {
			return res.status(400).json({
				success: false,
				message: "Purchase order must contain at least one item",
			});
		}
		const supplierResult = await client.query(`
      SELECT id
      FROM app.suppliers
      WHERE id = $1
      AND status = 'ACTIVE'
      `,
			[supplier_id]);
		if (supplierResult.rows.length === 0) {
			return res.status(400).json({
				success: false,
				message: "Supplier not found or inactive",
			});
		}
		await client.query("BEGIN");
		const poResult = await client.query(`
      INSERT INTO app.purchase_orders (
  po_number,
  supplier_id,
  order_date,
  expected_date,
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
				po_number,
				supplier_id,
				order_date || null,
				expected_date || null,
				notes || null,
				createdBy,
			]);
		const purchaseOrder = poResult.rows[0];
		for (const item of items) {
			const {
				product_id,
				quantity,
				unit_price,
			} = item;
			if (!product_id || !quantity || Number(quantity) <= 0) {
				throw new Error("Each item must have a valid product_id and quantity");
			}
			const productResult = await client.query(`
        SELECT
          id,
          supplier_id,
          purchase_price,
          status
        FROM app.products
        WHERE id = $1
        `,
				[product_id]);
			if (productResult.rows.length === 0) {
				throw new Error(`Product not found: ${product_id}`);
			}
			const product = productResult.rows[0];
			if (product.status !== "ACTIVE") {
				throw new Error(`Product is inactive: ${product_id}`);
			}
			if (product.supplier_id !== supplier_id) {
				throw new Error(`Product ${product_id} does not belong to selected supplier`);
			}
			const finalUnitPrice = unit_price ?? product.purchase_price;
			if (Number(finalUnitPrice) < 0) {
				throw new Error("Unit price cannot be negative");
			}
			await client.query(`
        INSERT INTO app.purchase_order_items (
          purchase_order_id,
          product_id,
          quantity,
          unit_price
        )
        VALUES ($1, $2, $3, $4)
        `,
				[
					purchaseOrder.id,
					product_id,
					quantity,
					finalUnitPrice,
				]);
		}
		await client.query("COMMIT");
		const itemsResult = await pool.query(`
      SELECT
        poi.id,
        poi.product_id,
        p.sku,
        p.product_name,
        poi.quantity,
        poi.unit_price,
        (poi.quantity * poi.unit_price) AS subtotal
      FROM app.purchase_order_items poi
      JOIN app.products p
        ON p.id = poi.product_id
      WHERE poi.purchase_order_id = $1
      `,
			[purchaseOrder.id]);
		res.status(201).json({
			success: true,
			message: "Purchase order created successfully",
			data: {
				...purchaseOrder,
				items: itemsResult.rows,
			},
		});
	} catch (error) {
		await client.query("ROLLBACK");
		console.error("Error creating purchase order:", error);
		if (error.code === "23505") {
			console.error("UNIQUE ERROR");
			console.error("Constraint:", error.constraint);
			console.error("Detail:", error.detail);
			return res.status(409).json({
				success: false,
				message: "Duplicate data detected",
				constraint: error.constraint,
				detail: error.detail,
			});
		}
		res.status(400).json({
			success: false,
			message: error.message || "Failed to create purchase order",
		});
	} finally {
		client.release();
	}
};
const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const normalizedStatus =
      typeof req.body.status === "string"
        ? req.body.status.trim().toUpperCase()
        : "";

    const allowedTargetStatuses = [
      "SUBMITTED",
      "CANCELLED",
    ];

    if (
      !allowedTargetStatuses.includes(
        normalizedStatus,
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Status must be SUBMITTED or CANCELLED",
      });
    }

    const currentResult = await pool.query(
      `
      SELECT id, status
      FROM app.purchase_orders
      WHERE id = $1
      `,
      [id],
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    const currentStatus =
      currentResult.rows[0].status;

    const allowedTransitions = {
      DRAFT: ["SUBMITTED", "CANCELLED"],
      SUBMITTED: ["CANCELLED"],
      PARTIALLY_RECEIVED: [],
      RECEIVED: [],
      CANCELLED: [],
    };

    if (
      !allowedTransitions[currentStatus]?.includes(
        normalizedStatus,
      )
    ) {
      return res.status(409).json({
        success: false,
        message:
          `Purchase order status cannot be changed ` +
          `from ${currentStatus} to ${normalizedStatus}`,
      });
    }

    const result = await pool.query(
      `
      UPDATE app.purchase_orders
      SET status = $1
      WHERE id = $2
      AND status = $3
      RETURNING *
      `,
      [
        normalizedStatus,
        id,
        currentStatus,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        success: false,
        message:
          "Purchase order status changed during the request",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Purchase order status updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase order ID",
      });
    }

    console.error(
      "Error updating purchase order status:",
      error,
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to update purchase order status",
    });
  }
};
module.exports = {
	getAllPurchaseOrders,
	getPurchaseOrderById,
	createPurchaseOrder,
	updatePurchaseOrderStatus,
};
