const pool = require("../config/database");
const isValidUUID = value => {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(value)
};
const getAllSuppliers = async (req, res) => {
	try {
		const {
			search = "",
			status,
			page = 1,
			limit = 10,
		} = req.query;

		const pageNumber = Number(page);
		const limitNumber = Number(limit);

		if (
			!Number.isInteger(pageNumber) ||
			pageNumber < 1 ||
			!Number.isInteger(limitNumber) ||
			limitNumber < 1 ||
			limitNumber > 100
		) {
			return res.status(400).json({
				success: false,
				message: "Invalid pagination parameters",
			});
		}

		if (status && !["ACTIVE", "INACTIVE"].includes(status)) {
			return res.status(400).json({
				success: false,
				message: "Status must be ACTIVE or INACTIVE",
			});
		}

		const offset = (pageNumber - 1) * limitNumber;

		const conditions = [];
		const values = [];

		if (search) {
			values.push(`%${search}%`);

			conditions.push(`
  (
    supplier_code ILIKE $${values.length}
    OR supplier_name ILIKE $${values.length}
    OR contact_person ILIKE $${values.length}
    OR phone ILIKE $${values.length}
    OR email ILIKE $${values.length}
    OR city ILIKE $${values.length}
  )
`);
		}

		if (status) {
			values.push(status);

			conditions.push(
				`status = $${values.length}`
			);
		}

		const whereClause =
			conditions.length > 0
				? `WHERE ${conditions.join(" AND ")}`
				: "";

		const countQuery = `
      SELECT COUNT(*)::INTEGER AS total
      FROM app.suppliers
      ${whereClause}
    `;

		const countResult = await pool.query(
			countQuery,
			values
		);

		const total = countResult.rows[0].total;

		const dataValues = [...values];

		dataValues.push(limitNumber);
		const limitParam = dataValues.length;

		dataValues.push(offset);
		const offsetParam = dataValues.length;

		const dataQuery = `
      SELECT
        id,
        supplier_code,
        supplier_name,
        contact_person,
        phone,
        email,
        city,
        payment_terms_days,
        status,
        created_at,
        updated_at
      FROM app.suppliers
      ${whereClause}
      ORDER BY supplier_name ASC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
    `;

		const result = await pool.query(
			dataQuery,
			dataValues
		);

		res.status(200).json({
			success: true,
			message: "Suppliers retrieved successfully",
			data: result.rows,
			pagination: {
				page: pageNumber,
				limit: limitNumber,
				total,
				total_pages: Math.ceil(total / limitNumber),
			},
		});
	} catch (error) {
		console.error("Error fetching suppliers:", error);

		res.status(500).json({
			success: false,
			message: "Failed to retrieve suppliers",
		});
	}
};
const getSupplierById = async (req, res) => {
	try {
		const {
			id
		} = req.params;
		if (!isValidUUID(id)) {
			return res.status(400).json({
				success: false,
				message: "Invalid supplier ID"
			})
		}
		const result = await pool.query(`\n      SELECT\n        id,\n        supplier_code,\n        supplier_name,\n        contact_person,\n        phone,\n        email,\n        address,\n        city,\n        payment_terms_days,\n        status,\n        notes,\n        created_at,\n        updated_at\n      FROM app.suppliers\n      WHERE id = $1\n      `, [id]);
		if (result.rows.length === 0) {
			return res.status(404).json({
				success: false,
				message: "Supplier not found"
			})
		}
		res.status(200).json({
			success: true,
			message: "Supplier retrieved successfully",
			data: result.rows[0]
		})
	} catch (error) {
		console.error("Error fetching supplier:", error);
		res.status(500).json({
			success: false,
			message: "Failed to retrieve supplier"
		})
	}
};
const createSupplier = async (req, res) => {
	try {
		const {
			supplier_code,
			supplier_name,
			contact_person,
			phone,
			email,
			address,
			city,
			payment_terms_days,
			notes
		} = req.body;
		if (!supplier_code || !supplier_name) {
			return res.status(400).json({
				success: false,
				message: "supplier_code and supplier_name are required"
			})
		}
		const result = await pool.query(`\n      INSERT INTO app.suppliers (\n        supplier_code,\n        supplier_name,\n        contact_person,\n        phone,\n        email,\n        address,\n        city,\n        payment_terms_days,\n        notes\n      )\n      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)\n      RETURNING *\n      `, [supplier_code, supplier_name, contact_person || null, phone || null, email || null, address || null, city || null, payment_terms_days ?? 0, notes || null]);
		res.status(201).json({
			success: true,
			message: "Supplier created successfully",
			data: result.rows[0]
		})
	} catch (error) {
		console.error("Error creating supplier:", error);
		if (error.code === "23505") {
			return res.status(409).json({
				success: false,
				message: "Supplier code already exists"
			})
		}
		res.status(500).json({
			success: false,
			message: "Failed to create supplier"
		})
	}
};
const updateSupplier = async (req, res) => {
	try {
		const {
			id
		} = req.params;
		const {
			supplier_code,
			supplier_name,
			contact_person,
			phone,
			email,
			address,
			city,
			payment_terms_days,
			notes
		} = req.body;
		if (!supplier_code || !supplier_name) {
			return res.status(400).json({
				success: false,
				message: "supplier_code and supplier_name are required"
			})
		}
		if (!isValidUUID(id)) {
			return res.status(400).json({
				success: false,
				message: "Invalid supplier ID",
			});
		}
		const result = await pool.query(`\n      UPDATE app.suppliers\n      SET\n        supplier_code = $1,\n        supplier_name = $2,\n        contact_person = $3,\n        phone = $4,\n        email = $5,\n        address = $6,\n        city = $7,\n        payment_terms_days = $8,\n        notes = $9\n      WHERE id = $10\n      RETURNING *\n      `, [supplier_code, supplier_name, contact_person || null, phone || null, email || null, address || null, city || null, payment_terms_days ?? 0, notes || null, id]);
		if (result.rows.length === 0) {
			return res.status(404).json({
				success: false,
				message: "Supplier not found"
			})
		}
		res.status(200).json({
			success: true,
			message: "Supplier updated successfully",
			data: result.rows[0]
		})
	} catch (error) {
		console.error("Error updating supplier:", error);
		if (error.code === "23505") {
			return res.status(409).json({
				success: false,
				message: "Supplier code already exists"
			})
		}
		res.status(500).json({
			success: false,
			message: "Failed to update supplier"
		})
	}
};
const updateSupplierStatus = async (req, res) => {
	try {
		const {
			id
		} = req.params;
		const {
			status
		} = req.body;
		const allowedStatus = ["ACTIVE", "INACTIVE"];
		if (!allowedStatus.includes(status)) {
			return res.status(400).json({
				success: false,
				message: "Status must be ACTIVE or INACTIVE"
			})
		}
		if (!isValidUUID(id)) {
			return res.status(400).json({
				success: false,
				message: "Invalid supplier ID",
			});
		}
		const result = await pool.query(`\n      UPDATE app.suppliers\n      SET status = $1\n      WHERE id = $2\n      RETURNING *\n      `, [status, id]);
		if (result.rows.length === 0) {
			return res.status(404).json({
				success: false,
				message: "Supplier not found"
			})
		}
		res.status(200).json({
			success: true,
			message: "Supplier status updated successfully",
			data: result.rows[0]
		})
	} catch (error) {
		console.error("Error updating supplier status:", error);
		res.status(500).json({
			success: false,
			message: "Failed to update supplier status"
		})
	}
};
module.exports = {
	getAllSuppliers,
	getSupplierById,
	createSupplier,
	updateSupplier,
	updateSupplierStatus
};
