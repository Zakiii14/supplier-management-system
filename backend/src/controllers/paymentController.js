const pool = require("../config/database");

const {
	parseDateRange,
} = require("../utils/dateRange");

const PAYMENT_METHODS = [
	"CASH",
	"BANK_TRANSFER",
	"GIRO",
	"OTHER",
];

const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidDateInput = (value) => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}

	const parsedDate = new Date(
		`${value}T00:00:00.000Z`,
	);

	return (
		!Number.isNaN(parsedDate.getTime()) &&
		parsedDate.toISOString().slice(0, 10) ===
		value
	);
};

const createRequestError = (
	message,
	statusCode = 400,
) => {
	const error = new Error(message);

	error.statusCode = statusCode;

	return error;
};

const getAllPayments = async (req, res) => {
	try {
		const {
			search = "",
			method = "",
			invoice_id = "",
			customer_id = "",
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

		const normalizedSearch =
			typeof search === "string"
				? search.trim()
				: "";

		const normalizedMethod =
			typeof method === "string"
				? method.trim().toUpperCase()
				: "";

		if (
			normalizedMethod &&
			!PAYMENT_METHODS.includes(normalizedMethod)
		) {
			return res.status(400).json({
				success: false,
				message: "Invalid payment method",
			});
		}

		const normalizedInvoiceId =
			typeof invoice_id === "string"
				? invoice_id.trim()
				: "";

		const normalizedCustomerId =
			typeof customer_id === "string"
				? customer_id.trim()
				: "";

		if (
			normalizedInvoiceId &&
			!UUID_PATTERN.test(normalizedInvoiceId)
		) {
			return res.status(400).json({
				success: false,
				message: "Invalid invoice ID",
			});
		}

		if (
			normalizedCustomerId &&
			!UUID_PATTERN.test(normalizedCustomerId)
		) {
			return res.status(400).json({
				success: false,
				message: "Invalid customer ID",
			});
		}

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
          p.payment_number ILIKE $${values.length}
          OR i.invoice_number ILIKE $${values.length}
          OR so.so_number ILIKE $${values.length}
          OR c.customer_code ILIKE $${values.length}
          OR c.customer_name ILIKE $${values.length}
          OR COALESCE(p.reference_number, '')
            ILIKE $${values.length}
          OR COALESCE(p.notes, '')
            ILIKE $${values.length}
          OR COALESCE(u.full_name, '')
            ILIKE $${values.length}
        )
      `);
		}

		if (normalizedMethod) {
			values.push(normalizedMethod);

			conditions.push(
				`p.method::TEXT = $${values.length}`,
			);
		}

		if (normalizedInvoiceId) {
			values.push(normalizedInvoiceId);

			conditions.push(
				`p.invoice_id = $${values.length}`,
			);
		}

		if (normalizedCustomerId) {
			values.push(normalizedCustomerId);

			conditions.push(
				`i.customer_id = $${values.length}`,
			);
		}

		if (dateFrom) {
			values.push(dateFrom);

			conditions.push(
				`p.payment_date >= $${values.length}::DATE`,
			);
		}

		if (dateTo) {
			values.push(dateTo);

			conditions.push(
				`p.payment_date <= $${values.length}::DATE`,
			);
		}

		const whereClause = conditions.length
			? `WHERE ${conditions.join(" AND ")}`
			: "";

		const countResult = await pool.query(
			`
      SELECT COUNT(*)::INTEGER AS total
      FROM app.payments p
      JOIN app.invoices i
        ON i.id = p.invoice_id
      JOIN app.sales_orders so
        ON so.id = i.sales_order_id
      JOIN app.customers c
        ON c.id = i.customer_id
      LEFT JOIN app.users u
        ON u.id = p.received_by
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
        p.id,
        p.payment_number,
        p.invoice_id,
        i.invoice_number,
        i.sales_order_id,
        so.so_number,
        i.customer_id,
        c.customer_code,
        c.customer_name,
        p.payment_date,
        p.amount,
        p.method,
        p.reference_number,
        p.notes,
        p.received_by,
        u.full_name AS received_by_name,
        i.invoice_date,
        i.due_date,
        i.grand_total,
        i.paid_amount,
        (
          i.grand_total - i.paid_amount
        ) AS outstanding_amount,
        CASE
          WHEN
            i.due_date < CURRENT_DATE
            AND i.status IN (
              'UNPAID',
              'PARTIAL'
            )
          THEN 'OVERDUE'::app.invoice_status
          ELSE i.status
        END AS invoice_status,
        p.created_at
      FROM app.payments p
      JOIN app.invoices i
        ON i.id = p.invoice_id
      JOIN app.sales_orders so
        ON so.id = i.sales_order_id
      JOIN app.customers c
        ON c.id = i.customer_id
      LEFT JOIN app.users u
        ON u.id = p.received_by
      ${whereClause}
      ORDER BY
        p.payment_date DESC,
        p.created_at DESC
      LIMIT $${limitPosition}
      OFFSET $${offsetPosition}
      `,
			listValues,
		);

		res.status(200).json({
			success: true,
			message: "Payments retrieved successfully",
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
			"Error fetching payments:",
			error,
		);

		if (error.code === "22P02") {
			return res.status(400).json({
				success: false,
				message: "Invalid payment filters",
			});
		}

		res.status(500).json({
			success: false,
			message: "Failed to retrieve payments",
		});
	}
};

const getPaymentEligibleInvoices = async (
	req,
	res,
) => {
	try {
		const result = await pool.query(
			`
      SELECT
        i.id,
        i.invoice_number,
        i.sales_order_id,
        so.so_number,
        i.customer_id,
        c.customer_code,
        c.customer_name,
        c.contact_person,
        c.phone,
        c.email,
        c.address,
        c.city,
        i.invoice_date,
        i.due_date,
        i.grand_total,
        i.paid_amount,
        (
          i.grand_total - i.paid_amount
        ) AS outstanding_amount,
        CASE
          WHEN
            i.due_date < CURRENT_DATE
            AND i.status IN (
              'UNPAID',
              'PARTIAL'
            )
          THEN 'OVERDUE'::app.invoice_status
          ELSE i.status
        END AS status,
        (
          i.due_date < CURRENT_DATE
          AND i.status IN (
            'UNPAID',
            'PARTIAL'
          )
        ) AS is_overdue
      FROM app.invoices i
      JOIN app.sales_orders so
        ON so.id = i.sales_order_id
      JOIN app.customers c
        ON c.id = i.customer_id
      WHERE i.status IN (
        'UNPAID',
        'PARTIAL'
      )
        AND i.grand_total > i.paid_amount
      ORDER BY
        i.due_date ASC,
        i.invoice_number ASC
      `,
		);

		res.status(200).json({
			success: true,
			message:
				"Payment eligible invoices retrieved successfully",
			data: result.rows,
		});
	} catch (error) {
		console.error(
			"Error fetching payment eligible invoices:",
			error,
		);

		res.status(500).json({
			success: false,
			message:
				"Failed to retrieve payment eligible invoices",
		});
	}
};

const getPaymentById = async (req, res) => {
	try {
		const { id } = req.params;

		const result = await pool.query(
			`
      SELECT
        p.id,
        p.payment_number,
        p.invoice_id,
        p.payment_date,
        p.amount,
        p.method,
        p.reference_number,
        p.notes,
        p.received_by,
        u.full_name AS received_by_name,
        p.created_at,
        i.invoice_number,
        i.sales_order_id,
        so.so_number,
        i.customer_id,
        c.customer_code,
        c.customer_name,
        c.contact_person,
        c.phone,
        c.email,
        c.address,
        c.city,
        i.invoice_date,
        i.due_date,
        i.grand_total,
        i.paid_amount,
        (
          i.grand_total - i.paid_amount
        ) AS outstanding_amount,
        CASE
          WHEN
            i.due_date < CURRENT_DATE
            AND i.status IN (
              'UNPAID',
              'PARTIAL'
            )
          THEN 'OVERDUE'::app.invoice_status
          ELSE i.status
        END AS invoice_status,
        (
          i.due_date < CURRENT_DATE
          AND i.status IN (
            'UNPAID',
            'PARTIAL'
          )
        ) AS invoice_is_overdue
      FROM app.payments p
      JOIN app.invoices i
        ON i.id = p.invoice_id
      JOIN app.sales_orders so
        ON so.id = i.sales_order_id
      JOIN app.customers c
        ON c.id = i.customer_id
      LEFT JOIN app.users u
        ON u.id = p.received_by
      WHERE p.id = $1
      `,
			[id],
		);

		if (result.rows.length === 0) {
			return res.status(404).json({
				success: false,
				message: "Payment not found",
			});
		}

		res.status(200).json({
			success: true,
			message: "Payment retrieved successfully",
			data: result.rows[0],
		});
	} catch (error) {
		console.error(
			"Error fetching payment:",
			error,
		);

		if (error.code === "22P02") {
			return res.status(400).json({
				success: false,
				message: "Invalid payment ID",
			});
		}

		res.status(500).json({
			success: false,
			message: "Failed to retrieve payment",
		});
	}
};

const createPayment = async (req, res) => {
	const client = await pool.connect();
	let transactionStarted = false;

	try {
		const {
			payment_number,
			invoice_id,
			payment_date,
			amount,
			method,
			reference_number,
			notes,
		} = req.body;

		const normalizedPaymentNumber =
			typeof payment_number === "string"
				? payment_number.trim().toUpperCase()
				: "";

		const normalizedInvoiceId =
			typeof invoice_id === "string"
				? invoice_id.trim()
				: "";

		const normalizedPaymentDate =
			typeof payment_date === "string"
				? payment_date.trim()
				: "";

		const normalizedMethod =
			typeof method === "string"
				? method.trim().toUpperCase()
				: "";

		const normalizedReferenceNumber =
			typeof reference_number === "string"
				? reference_number.trim()
				: "";

		const normalizedNotes =
			typeof notes === "string"
				? notes.trim()
				: "";

		if (
			!normalizedPaymentNumber ||
			!normalizedInvoiceId ||
			amount === undefined ||
			amount === null ||
			!normalizedMethod
		) {
			return res.status(400).json({
				success: false,
				message:
					"payment_number, invoice_id, amount, and method are required",
			});
		}

		if (!UUID_PATTERN.test(normalizedInvoiceId)) {
			return res.status(400).json({
				success: false,
				message: "Invalid invoice ID",
			});
		}

		const numericAmount = Number(amount);

		if (
			!Number.isFinite(numericAmount) ||
			numericAmount <= 0
		) {
			return res.status(400).json({
				success: false,
				message:
					"Payment amount must be greater than zero",
			});
		}

		if (!PAYMENT_METHODS.includes(normalizedMethod)) {
			return res.status(400).json({
				success: false,
				message: "Invalid payment method",
			});
		}

		if (
			normalizedPaymentDate &&
			!isValidDateInput(normalizedPaymentDate)
		) {
			return res.status(400).json({
				success: false,
				message:
					"payment_date must be a valid date in YYYY-MM-DD format",
			});
		}

		await client.query("BEGIN");
		transactionStarted = true;

		const duplicateResult = await client.query(
			`
      SELECT id
      FROM app.payments
      WHERE UPPER(payment_number) = $1
      `,
			[normalizedPaymentNumber],
		);

		if (duplicateResult.rows.length > 0) {
			throw createRequestError(
				"Payment number already exists",
				409,
			);
		}

		const invoiceResult = await client.query(
			`
      SELECT
        id,
        invoice_number,
        invoice_date,
        grand_total,
        paid_amount,
        status
      FROM app.invoices
      WHERE id = $1
      FOR UPDATE
      `,
			[normalizedInvoiceId],
		);

		if (invoiceResult.rows.length === 0) {
			throw createRequestError(
				"Invoice not found",
				404,
			);
		}

		const invoice = invoiceResult.rows[0];

		if (invoice.status === "CANCELLED") {
			throw createRequestError(
				"Cancelled invoice cannot receive payment",
			);
		}

		if (invoice.status === "PAID") {
			throw createRequestError(
				"Invoice has already been paid",
			);
		}

		const outstandingAmount =
			Number(invoice.grand_total) -
			Number(invoice.paid_amount);

		if (outstandingAmount <= 0) {
			throw createRequestError(
				"Invoice has no outstanding amount",
			);
		}

		if (numericAmount > outstandingAmount) {
			throw createRequestError(
				`Payment exceeds outstanding amount (${outstandingAmount})`,
			);
		}

		const dateResult = await client.query(
			`
      SELECT
        COALESCE($1::DATE, CURRENT_DATE)
          < $2::DATE AS invalid_date
      `,
			[
				normalizedPaymentDate || null,
				invoice.invoice_date,
			],
		);

		if (dateResult.rows[0].invalid_date) {
			throw createRequestError(
				"Payment date cannot be earlier than invoice date",
			);
		}

		const paymentResult = await client.query(
			`
      INSERT INTO app.payments (
        payment_number,
        invoice_id,
        payment_date,
        amount,
        method,
        reference_number,
        notes,
        received_by
      )
      VALUES (
        $1,
        $2,
        COALESCE($3::DATE, CURRENT_DATE),
        $4,
        $5,
        $6,
        $7,
        $8
      )
      RETURNING *
      `,
			[
				normalizedPaymentNumber,
				normalizedInvoiceId,
				normalizedPaymentDate || null,
				numericAmount,
				normalizedMethod,
				normalizedReferenceNumber || null,
				normalizedNotes || null,
				req.user.id,
			],
		);

		const updatedInvoiceResult =
			await client.query(
				`
        UPDATE app.invoices
        SET
          paid_amount = paid_amount + $1,
          status = CASE
            WHEN paid_amount + $1 >= grand_total
              THEN 'PAID'::app.invoice_status
            ELSE 'PARTIAL'::app.invoice_status
          END,
          updated_at = NOW()
        WHERE id = $2
        RETURNING
          id,
          invoice_number,
          grand_total,
          paid_amount,
          (
            grand_total - paid_amount
          ) AS outstanding_amount,
          status
        `,
				[numericAmount, normalizedInvoiceId],
			);

		await client.query("COMMIT");
		transactionStarted = false;

		res.status(201).json({
			success: true,
			message: "Payment created successfully",
			data: {
				payment: paymentResult.rows[0],
				invoice: updatedInvoiceResult.rows[0],
			},
		});
	} catch (error) {
		if (transactionStarted) {
			await client.query("ROLLBACK");
		}

		if (error.code === "23505") {
			return res.status(409).json({
				success: false,
				message: "Payment number already exists",
			});
		}

		if (error.code === "22P02") {
			return res.status(400).json({
				success: false,
				message: "Invalid payment data",
			});
		}

		if (error.statusCode) {
			return res
				.status(error.statusCode)
				.json({
					success: false,
					message: error.message,
				});
		}

		console.error(
			"Error creating payment:",
			error,
		);

		res.status(500).json({
			success: false,
			message: "Failed to create payment",
		});
	} finally {
		client.release();
	}
};

module.exports = {
	getAllPayments,
	getPaymentEligibleInvoices,
	getPaymentById,
	createPayment,
};
