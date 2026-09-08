const pool = require("../config/database");

const CONFIG = {
  purchaseOrder: {
    table: "app.purchase_orders",
    type: "PURCHASE_ORDER",
    approvedStatus: "SUBMITTED",
    labelField: "po_number",
  },
  salesOrder: {
    table: "app.sales_orders",
    type: "SALES_ORDER",
    approvedStatus: "CONFIRMED",
    labelField: "so_number",
  },
};

const validateSalesOrderStock = async (client, orderId) => {
  const result = await client.query(
    `
    SELECT soi.quantity, p.product_name, p.current_stock, p.status
    FROM app.sales_order_items soi
    JOIN app.products p ON p.id = soi.product_id
    WHERE soi.sales_order_id = $1
    `,
    [orderId],
  );

  for (const item of result.rows) {
    if (item.status !== "ACTIVE") {
      throw new Error(`${item.product_name} sudah tidak aktif`);
    }

    if (Number(item.quantity) > Number(item.current_stock)) {
      throw new Error(
        `Stok ${item.product_name} tidak mencukupi. Tersedia: ${Number(item.current_stock)}`,
      );
    }
  }
};

const submitOrderApproval = (configKey) => async (req, res) => {
  const config = CONFIG[configKey];
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      `SELECT id, ${config.labelField}, status, approval_status
       FROM ${config.table}
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id],
    );

    if (currentResult.rows.length === 0) {
      const error = new Error("Transaksi tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    const current = currentResult.rows[0];

    if (current.status !== "DRAFT") {
      const error = new Error("Hanya transaksi draft yang dapat diajukan");
      error.statusCode = 409;
      throw error;
    }

    if (current.approval_status === "PENDING") {
      const error = new Error("Transaksi ini sudah menunggu persetujuan");
      error.statusCode = 409;
      throw error;
    }

    if (!["DRAFT", "REJECTED"].includes(current.approval_status)) {
      const error = new Error("Transaksi ini tidak dapat diajukan kembali");
      error.statusCode = 409;
      throw error;
    }

    const action = current.approval_status === "REJECTED"
      ? "RESUBMITTED"
      : "SUBMITTED";

    const result = await client.query(
      `UPDATE ${config.table}
       SET approval_status = 'PENDING',
           submitted_by = $1,
           submitted_at = NOW(),
           decided_by = NULL,
           decided_at = NULL,
           rejection_reason = NULL,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user.id, req.params.id],
    );

    await client.query(
      `INSERT INTO app.transaction_approvals
       (transaction_type, transaction_id, action, acted_by)
       VALUES ($1, $2, $3, $4)`,
      [config.type, req.params.id, action, req.user.id],
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Transaksi berhasil diajukan untuk persetujuan",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "22P02") {
      return res.status(400).json({ success: false, message: "ID transaksi tidak valid" });
    }

    console.error("Error submitting transaction approval:", error);
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Transaksi gagal diajukan",
    });
  } finally {
    client.release();
  }
};

const decideOrderApproval = (configKey) => async (req, res) => {
  const config = CONFIG[configKey];
  const client = await pool.connect();

  try {
    const decision = typeof req.body.decision === "string"
      ? req.body.decision.trim().toUpperCase()
      : "";
    const reason = typeof req.body.reason === "string"
      ? req.body.reason.trim()
      : "";

    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Keputusan harus berupa APPROVED atau REJECTED",
      });
    }

    if (decision === "REJECTED" && (reason.length < 5 || reason.length > 500)) {
      return res.status(400).json({
        success: false,
        message: "Alasan penolakan harus berisi 5 sampai 500 karakter",
      });
    }

    await client.query("BEGIN");

    const currentResult = await client.query(
      `SELECT id, ${config.labelField}, status, approval_status, submitted_by
       FROM ${config.table}
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id],
    );

    if (currentResult.rows.length === 0) {
      const error = new Error("Transaksi tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    const current = currentResult.rows[0];

    if (current.approval_status !== "PENDING" || current.status !== "DRAFT") {
      const error = new Error("Transaksi ini sudah tidak menunggu persetujuan");
      error.statusCode = 409;
      throw error;
    }

    if (current.submitted_by === req.user.id) {
      const error = new Error("Pengaju tidak dapat menyetujui atau menolak transaksinya sendiri");
      error.statusCode = 403;
      throw error;
    }

    if (decision === "APPROVED" && configKey === "salesOrder") {
      await validateSalesOrderStock(client, req.params.id);
    }

    const nextStatus = decision === "APPROVED"
      ? config.approvedStatus
      : "DRAFT";

    const result = await client.query(
      `UPDATE ${config.table}
       SET status = $1,
           approval_status = $2,
           decided_by = $3,
           decided_at = NOW(),
           rejection_reason = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [nextStatus, decision, req.user.id, decision === "REJECTED" ? reason : null, req.params.id],
    );

    await client.query(
      `INSERT INTO app.transaction_approvals
       (transaction_type, transaction_id, action, reason, acted_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [config.type, req.params.id, decision, decision === "REJECTED" ? reason : null, req.user.id],
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: decision === "APPROVED"
        ? "Transaksi berhasil disetujui"
        : "Transaksi berhasil ditolak",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "22P02") {
      return res.status(400).json({ success: false, message: "ID transaksi tidak valid" });
    }

    console.error("Error deciding transaction approval:", error);
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Keputusan persetujuan gagal disimpan",
    });
  } finally {
    client.release();
  }
};

const getOrderApprovalHistory = (configKey) => async (req, res) => {
  const config = CONFIG[configKey];

  try {
    const orderResult = await pool.query(
      `SELECT id FROM ${config.table} WHERE id = $1`,
      [req.params.id],
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Transaksi tidak ditemukan" });
    }

    const result = await pool.query(
      `SELECT ta.id, ta.action, ta.reason, ta.acted_at,
              u.full_name AS acted_by_name, u.role AS acted_by_role
       FROM app.transaction_approvals ta
       LEFT JOIN app.users u ON u.id = ta.acted_by
       WHERE ta.transaction_type = $1 AND ta.transaction_id = $2
       ORDER BY ta.acted_at DESC`,
      [config.type, req.params.id],
    );

    return res.status(200).json({
      success: true,
      message: "Riwayat persetujuan berhasil dimuat",
      data: result.rows,
    });
  } catch (error) {
    if (error.code === "22P02") {
      return res.status(400).json({ success: false, message: "ID transaksi tidak valid" });
    }

    console.error("Error fetching transaction approval history:", error);
    return res.status(500).json({ success: false, message: "Riwayat persetujuan gagal dimuat" });
  }
};

module.exports = {
  decidePurchaseOrderApproval: decideOrderApproval("purchaseOrder"),
  decideSalesOrderApproval: decideOrderApproval("salesOrder"),
  getPurchaseOrderApprovalHistory: getOrderApprovalHistory("purchaseOrder"),
  getSalesOrderApprovalHistory: getOrderApprovalHistory("salesOrder"),
  submitPurchaseOrderApproval: submitOrderApproval("purchaseOrder"),
  submitSalesOrderApproval: submitOrderApproval("salesOrder"),
};
