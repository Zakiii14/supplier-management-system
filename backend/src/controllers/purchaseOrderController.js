const pool = require("../config/database");
const {
	resolveCodeNumber,
} = require("../services/codeNumberService");
const {
  parseDateRange,
} = require("../utils/dateRange");

const PAYMENT_SCHEMES = [
  "DIRECT",
  "TERM",
  "DOWN_PAYMENT",
  "COD",
];

const getAllPurchaseOrders = async (req, res) => {
  try {
    const canViewSupplierPayments = [
      "ADMIN",
      "PURCHASING",
      "FINANCE",
      "MANAGER",
    ].includes(req.user.role);
    const {
      search = "",
      status = "",
      date_from = "",
      date_to = "",
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
      "PENDING_APPROVAL",
      "REJECTED_APPROVAL",
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
      if (normalizedStatus === "DRAFT") {
        conditions.push("po.status = 'DRAFT' AND po.approval_status = 'DRAFT'");
      } else if (normalizedStatus === "PENDING_APPROVAL") {
        conditions.push("po.approval_status = 'PENDING'");
      } else if (normalizedStatus === "REJECTED_APPROVAL") {
        conditions.push("po.approval_status = 'REJECTED'");
      } else {
        values.push(normalizedStatus);
        conditions.push(`po.status = $${values.length}`);
      }
    }

    if (dateFrom) {
      values.push(dateFrom);

      conditions.push(
        `po.order_date >= $${values.length}::DATE`,
      );
    }

    if (dateTo) {
      values.push(dateTo);

      conditions.push(
        `po.order_date <= $${values.length}::DATE`,
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
        po.approval_status,
        po.submitted_by,
        po.submitted_at,
        po.decided_by,
        po.decided_at,
        po.rejection_reason,
        po.notes,
        po.payment_scheme,
        po.payment_terms_days,
        po.down_payment_percent,
        po.created_by,
        po.created_at,
        po.updated_at,
        s.id AS supplier_id,
        s.supplier_code,
        s.supplier_name,
        COALESCE(summary.total_amount, 0)
          AS total_amount,
        COALESCE(summary.total_items, 0)
          AS total_items,
        COALESCE(payment_summary.paid_amount, 0)
          AS paid_amount,
        GREATEST(
          COALESCE(summary.total_amount, 0) -
          COALESCE(payment_summary.paid_amount, 0),
          0
        ) AS outstanding_amount,
        CASE
          WHEN COALESCE(payment_summary.payment_count, 0) = 0
            THEN 'NOT_RECORDED'
          WHEN COALESCE(payment_summary.paid_amount, 0) >=
            COALESCE(summary.total_amount, 0)
            THEN 'PAID'
          ELSE 'PARTIAL'
        END AS payment_status
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
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(sp.amount), 0) AS paid_amount,
          COUNT(sp.id)::INTEGER AS payment_count
        FROM app.supplier_payments sp
        WHERE sp.purchase_order_id = po.id
      ) payment_summary ON TRUE
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
      data: result.rows.map((row) =>
        canViewSupplierPayments
          ? row
          : {
              ...row,
              paid_amount: undefined,
              outstanding_amount: undefined,
              payment_status: undefined,
            },
      ),
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
		const canViewSupplierPayments = [
			"ADMIN",
			"PURCHASING",
			"FINANCE",
			"MANAGER",
		].includes(req.user.role);
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
        po.approval_status,
        po.submitted_by,
        po.submitted_at,
        po.decided_by,
        po.decided_at,
        po.rejection_reason,
        po.notes,
		po.payment_scheme,
		po.payment_terms_days,
		po.down_payment_percent,
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
		const paymentsResult = canViewSupplierPayments
			? await pool.query(`
      SELECT
        sp.id,
        sp.payment_number,
        sp.payment_date,
        sp.amount,
        sp.method,
        sp.reference_number,
        sp.supplier_invoice_number,
        sp.notes,
        sp.paid_by,
        u.full_name AS paid_by_name,
        sp.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pp.id,
              'original_name', pp.original_name,
              'mime_type', pp.mime_type,
              'size_bytes', pp.size_bytes,
              'checksum_sha256', pp.checksum_sha256,
              'uploaded_by', pp.uploaded_by,
              'uploaded_by_name', proof_user.full_name,
              'created_at', pp.created_at,
              'updated_at', pp.updated_at
            ) ORDER BY pp.created_at
          ) FILTER (WHERE pp.id IS NOT NULL),
          '[]'::json
        ) AS proofs
      FROM app.supplier_payments sp
      LEFT JOIN app.users u ON u.id = sp.paid_by
      LEFT JOIN app.payment_proofs pp
        ON pp.supplier_payment_id = sp.id
      LEFT JOIN app.users proof_user
        ON proof_user.id = pp.uploaded_by
      WHERE sp.purchase_order_id = $1
      GROUP BY sp.id, u.full_name
      ORDER BY sp.payment_date DESC, sp.created_at DESC
		      `, [id])
			: { rows: [] };
		const supplierInvoicesResult = canViewSupplierPayments
			? await pool.query(`
				SELECT si.id,si.invoice_number,si.invoice_date,si.due_date,si.total_amount,
					(si.total_amount-COALESCE(SUM(sp.amount),0)) AS outstanding_amount
				FROM app.supplier_invoices si
				LEFT JOIN app.supplier_payments sp ON sp.supplier_invoice_id=si.id
				WHERE si.purchase_order_id=$1
				GROUP BY si.id ORDER BY si.invoice_date DESC`,[id])
			: { rows: [] };
		const paidAmount = paymentsResult.rows.reduce(
			(total, payment) => total + Number(payment.amount),
			0,
		);
		const paymentStatus = paymentsResult.rows.length === 0
			? "NOT_RECORDED"
			: paidAmount >= totalAmount
				? "PAID"
				: "PARTIAL";
		res.status(200).json({
			success: true,
			message: "Purchase order retrieved successfully",
			data: {
				...poResult.rows[0],
				items: itemsResult.rows,
				total_amount: totalAmount,
				...(canViewSupplierPayments
					? {
							paid_amount: paidAmount,
							outstanding_amount: Math.max(totalAmount - paidAmount, 0),
							payment_status: paymentStatus,
							supplier_payments: paymentsResult.rows,
							supplier_invoices: supplierInvoicesResult.rows,
						}
					: {}),
				can_view_supplier_payments: canViewSupplierPayments,
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
			payment_scheme,
			payment_terms_days,
			down_payment_percent,
		} = req.body;
		const createdBy = req.user.id;
		if (!supplier_id) {
			return res.status(400).json({
				success: false,
				message: "supplier_id is required",
			});
		}
		if (!Array.isArray(items) || items.length === 0) {
			return res.status(400).json({
				success: false,
				message: "Purchase order must contain at least one item",
			});
		}
		const supplierResult = await client.query(`
      SELECT
        s.id,
        s.payment_scheme,
        s.payment_terms_days,
        s.down_payment_percent,
        ps.default_purchase_scheme,
        ps.default_purchase_term_days,
        ps.default_down_payment_percent
      FROM app.suppliers s
      CROSS JOIN app.payment_settings ps
      WHERE s.id = $1
		AND ps.id = 1
      AND s.status = 'ACTIVE'
      `,
			[supplier_id]);
		if (supplierResult.rows.length === 0) {
			return res.status(400).json({
				success: false,
				message: "Supplier not found or inactive",
			});
		}
		const supplier = supplierResult.rows[0];
		const normalizedPaymentScheme =
			typeof payment_scheme === "string" && payment_scheme.trim()
				? payment_scheme.trim().toUpperCase()
				: supplier.payment_scheme || supplier.default_purchase_scheme;
		const resolvedPaymentTerms =
			payment_terms_days !== undefined && payment_terms_days !== null && payment_terms_days !== ""
				? Number(payment_terms_days)
				: Number(supplier.payment_terms_days) ||
					Number(supplier.default_purchase_term_days) || 0;
		const resolvedDownPayment =
			down_payment_percent !== undefined && down_payment_percent !== null && down_payment_percent !== ""
				? Number(down_payment_percent)
				: supplier.down_payment_percent !== null
					? Number(supplier.down_payment_percent)
					: Number(supplier.default_down_payment_percent) || 0;

		if (!PAYMENT_SCHEMES.includes(normalizedPaymentScheme)) {
			return res.status(400).json({
				success: false,
				message: "Invalid purchase payment scheme",
			});
		}

		if (!Number.isInteger(resolvedPaymentTerms) || resolvedPaymentTerms < 0 || resolvedPaymentTerms > 365) {
			return res.status(400).json({
				success: false,
				message: "Payment terms must be 0-365 days",
			});
		}

		if (!Number.isFinite(resolvedDownPayment) || resolvedDownPayment < 0 || resolvedDownPayment > 100) {
			return res.status(400).json({
				success: false,
				message: "Down payment must be 0-100 percent",
			});
		}
		await client.query("BEGIN");
		const resolvedPurchaseOrderNumber =
			await resolveCodeNumber({
				client,
				moduleKey: "PURCHASE_ORDER",
				manualCode: po_number,
			});
		const poResult = await client.query(`
      INSERT INTO app.purchase_orders (
  po_number,
  supplier_id,
  order_date,
  expected_date,
  status,
  payment_scheme,
  payment_terms_days,
  down_payment_percent,
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
  $6,
  $7,
  $8,
  $9
)
      RETURNING *
      `,
			[
				resolvedPurchaseOrderNumber,
				supplier_id,
				order_date || null,
				expected_date || null,
				normalizedPaymentScheme,
				resolvedPaymentTerms,
				resolvedDownPayment,
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

    const allowedTargetStatuses = ["CANCELLED"];

    if (
      !allowedTargetStatuses.includes(
        normalizedStatus,
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Status manual hanya dapat diubah menjadi CANCELLED",
      });
    }

    const currentResult = await pool.query(
      `
      SELECT id, status, approval_status
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
      DRAFT: ["CANCELLED"],
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
      SET status = $1,
          approval_status = 'CANCELLED',
          updated_at = NOW()
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
