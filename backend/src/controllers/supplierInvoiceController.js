const pool = require("../config/database");
const {
  store,
  remove,
  stream,
} = require("../services/supplierInvoiceAttachmentService");

const STATUSES = ["UNPAID", "PARTIAL", "PAID", "OVERDUE"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const baseSelect = `
  SELECT si.*, po.po_number, po.supplier_id, s.supplier_code, s.supplier_name,
    COALESCE(payment_summary.paid_amount,0)::numeric AS paid_amount,
    COALESCE(return_summary.credit_amount,0)::numeric AS return_credit_amount,
    COALESCE(refund_summary.refund_amount,0)::numeric AS supplier_refund_amount,
    GREATEST(si.total_amount-COALESCE(return_summary.credit_amount,0),0)::numeric AS adjusted_total_amount,
    GREATEST(si.total_amount-COALESCE(return_summary.credit_amount,0)-COALESCE(refund_summary.refund_amount,0),0)::numeric AS net_purchase_amount,
    GREATEST(si.total_amount-COALESCE(return_summary.credit_amount,0)-COALESCE(payment_summary.paid_amount,0),0)::numeric AS outstanding_amount,
    CASE WHEN COALESCE(payment_summary.paid_amount,0)>=GREATEST(si.total_amount-COALESCE(return_summary.credit_amount,0),0) THEN 'PAID'
      WHEN COALESCE(payment_summary.paid_amount,0)>0 THEN 'PARTIAL'
      WHEN si.due_date<CURRENT_DATE THEN 'OVERDUE' ELSE 'UNPAID' END AS effective_status,
    COALESCE(attachment_summary.attachment_count,0)::integer AS attachment_count
  FROM app.supplier_invoices si
  JOIN app.purchase_orders po ON po.id=si.purchase_order_id
  JOIN app.suppliers s ON s.id=po.supplier_id
  LEFT JOIN LATERAL (SELECT SUM(sp.amount) paid_amount FROM app.supplier_payments sp WHERE sp.supplier_invoice_id=si.id) payment_summary ON TRUE
  LEFT JOIN LATERAL (SELECT SUM(prs.amount) credit_amount FROM app.purchase_return_settlements prs WHERE prs.supplier_invoice_id=si.id AND prs.settlement_type IN ('INVOICE_DEDUCTION','SUPPLIER_CREDIT')) return_summary ON TRUE
  LEFT JOIN LATERAL (
    SELECT SUM(prs.amount) refund_amount
    FROM app.purchase_return_settlements prs
    JOIN app.purchase_returns pr ON pr.id=prs.purchase_return_id
    JOIN app.goods_receipts gr ON gr.id=pr.goods_receipt_id
    WHERE gr.purchase_order_id=si.purchase_order_id AND prs.settlement_type='REFUND'
  ) refund_summary ON TRUE
  LEFT JOIN LATERAL (SELECT COUNT(*) attachment_count FROM app.supplier_invoice_attachments sia WHERE sia.supplier_invoice_id=si.id) attachment_summary ON TRUE`;

const listSupplierInvoices = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 10),
    );
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").toUpperCase();
    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status tagihan tidak valid",
      });
    }

    const values = [];
    const where = [];
    if (search) {
      values.push(`%${search}%`);
      where.push(
        `(si.invoice_number ILIKE $${values.length} OR po.po_number ILIKE $${values.length} OR s.supplier_name ILIKE $${values.length})`,
      );
    }
    if (req.query.supplier_id) {
      values.push(req.query.supplier_id);
      where.push(`po.supplier_id=$${values.length}`);
    }
    if (req.query.date_from) {
      values.push(req.query.date_from);
      where.push(`si.invoice_date >= $${values.length}::date`);
    }
    if (req.query.date_to) {
      values.push(req.query.date_to);
      where.push(`si.invoice_date <= $${values.length}::date`);
    }

    const clause = where.length
      ? `WHERE ${where.join(" AND ")}`
      : "";
    const grouped = `${baseSelect} ${clause}`;
    let statusClause = "";
    if (status) {
      values.push(status);
      statusClause = `WHERE effective_status=$${values.length}`;
    }
    values.push(limit, (page - 1) * limit);
    const result = await pool.query(
      `SELECT q.*,COUNT(*) OVER()::integer AS filtered_total FROM (${grouped}) q ${statusClause} ORDER BY invoice_date DESC,created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    const total = result.rows[0]?.filtered_total || 0;
    const data = result.rows.map(
      ({ filtered_total, ...row }) => row,
    );
    return res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error listing supplier invoices:", error);
    return res
      .status(error.code === "22P02" ? 400 : 500)
      .json({
        success: false,
        message: "Tagihan supplier gagal dimuat",
      });
  }
};

const getSupplierInvoice = async (req, res) => {
  if (!UUID.test(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "ID tagihan tidak valid",
    });
  }
  const result = await pool.query(
    `${baseSelect} WHERE si.id=$1`,
    [req.params.id],
  );
  if (!result.rows.length) {
    return res.status(404).json({
      success: false,
      message: "Tagihan supplier tidak ditemukan",
    });
  }

  const [attachments, payments, returnSettlements] =
    await Promise.all([
      pool.query(
        `SELECT id,original_name,mime_type,size_bytes,created_at FROM app.supplier_invoice_attachments WHERE supplier_invoice_id=$1 ORDER BY created_at`,
        [req.params.id],
      ),
      pool.query(
        `SELECT id,payment_number,payment_date,amount,method,reference_number,notes FROM app.supplier_payments WHERE supplier_invoice_id=$1 ORDER BY payment_date DESC`,
        [req.params.id],
      ),
      pool.query(
        `SELECT prs.id,prs.settlement_type,prs.settlement_date,prs.amount,prs.reference_number,pr.return_number
      FROM app.purchase_return_settlements prs
      JOIN app.purchase_returns pr ON pr.id=prs.purchase_return_id
      JOIN app.goods_receipts gr ON gr.id=pr.goods_receipt_id
      WHERE prs.supplier_invoice_id=$1
         OR (prs.settlement_type='REFUND' AND gr.purchase_order_id=$2)
      ORDER BY prs.settlement_date DESC,prs.created_at DESC`,
        [req.params.id, result.rows[0].purchase_order_id],
      ),
    ]);

  return res.json({
    success: true,
    data: {
      ...result.rows[0],
      attachments: attachments.rows,
      payments: payments.rows,
      return_settlements: returnSettlements.rows,
    },
  });
};

const saveSupplierInvoice = async (req, res) => {
  const client = await pool.connect();
  const stored = [];
  try {
    const id = req.params.id;
    const invoiceNumber = String(
      req.body.invoice_number || "",
    ).trim();
    const poId = req.body.purchase_order_id;
    const invoiceDate = String(req.body.invoice_date || "");
    const dueDate = String(req.body.due_date || "");
    const total = Number(req.body.total_amount);

    if (
      !invoiceNumber ||
      !UUID.test(poId || "") ||
      !DATE.test(invoiceDate) ||
      !DATE.test(dueDate) ||
      dueDate < invoiceDate ||
      !Number.isFinite(total) ||
      total <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Nomor, PO, tanggal, jatuh tempo, dan total tagihan wajib valid",
      });
    }

    await client.query("BEGIN");
    const po = await client.query(
      `SELECT po.id,po.status,COALESCE((SELECT SUM(poi.quantity*poi.unit_price) FROM app.purchase_order_items poi WHERE poi.purchase_order_id=po.id),0) total FROM app.purchase_orders po WHERE po.id=$1 FOR UPDATE OF po`,
      [poId],
    );
    if (!po.rows.length) {
      const error = new Error("Purchase order tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }
    if (po.rows[0].status === "DRAFT") {
      const error = new Error(
        "Tagihan hanya dapat dibuat untuk PO yang sudah diajukan",
      );
      error.statusCode = 409;
      throw error;
    }
    if (total !== Number(po.rows[0].total)) {
      const error = new Error(
        `Total tagihan harus sama dengan nilai PO (${Number(po.rows[0].total)})`,
      );
      error.statusCode = 400;
      throw error;
    }

    const existingInvoice = await client.query(
      `SELECT id,invoice_number FROM app.supplier_invoices WHERE purchase_order_id=$1 AND ($2::uuid IS NULL OR id<>$2::uuid) LIMIT 1`,
      [poId, id || null],
    );
    if (existingInvoice.rows.length) {
      const error = new Error(
        `Purchase order sudah memiliki tagihan supplier (${existingInvoice.rows[0].invoice_number})`,
      );
      error.statusCode = 409;
      throw error;
    }

    if (id) {
      const usage = await client.query(
        `SELECT COALESCE((SELECT SUM(amount) FROM app.supplier_payments WHERE supplier_invoice_id=$1),0) paid,COALESCE((SELECT SUM(amount) FROM app.purchase_return_settlements WHERE supplier_invoice_id=$1 AND settlement_type IN ('INVOICE_DEDUCTION','SUPPLIER_CREDIT')),0) credited,COUNT(*)::integer attachments FROM app.supplier_invoice_attachments WHERE supplier_invoice_id=$1`,
        [id],
      );
      if (
        total <
        Number(usage.rows[0].paid) +
          Number(usage.rows[0].credited)
      ) {
        const error = new Error(
          "Total tagihan tidak boleh lebih kecil dari pembayaran dan kredit retur yang sudah tercatat",
        );
        error.statusCode = 400;
        throw error;
      }
      if (
        Number(usage.rows[0].attachments) +
          (req.files || []).length >
        3
      ) {
        const error = new Error(
          "Maksimal 3 lampiran untuk setiap invoice supplier",
        );
        error.statusCode = 400;
        throw error;
      }
    }

    const result = id
      ? await client.query(
          `UPDATE app.supplier_invoices SET invoice_number=$1,purchase_order_id=$2,invoice_date=$3,due_date=$4,total_amount=$5,notes=$6 WHERE id=$7 RETURNING *`,
          [
            invoiceNumber,
            poId,
            invoiceDate,
            dueDate,
            total,
            String(req.body.notes || "").trim() || null,
            id,
          ],
        )
      : await client.query(
          `INSERT INTO app.supplier_invoices(invoice_number,purchase_order_id,invoice_date,due_date,total_amount,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [
            invoiceNumber,
            poId,
            invoiceDate,
            dueDate,
            total,
            String(req.body.notes || "").trim() || null,
            req.user.id,
          ],
        );

    if (!result.rows.length) {
      const error = new Error("Tagihan supplier tidak ditemukan");
      error.statusCode = 404;
      throw error;
    }

    for (const file of req.files || []) {
      const saved = await store(file);
      stored.push(saved);
      await client.query(
        `INSERT INTO app.supplier_invoice_attachments(supplier_invoice_id,original_name,storage_name,mime_type,size_bytes,uploaded_by) VALUES($1,$2,$3,$4,$5,$6)`,
        [
          result.rows[0].id,
          saved.originalName,
          saved.storageName,
          saved.mimeType,
          saved.sizeBytes,
          req.user.id,
        ],
      );
    }

    await client.query(
      `UPDATE app.supplier_payments SET supplier_invoice_id=$1,supplier_invoice_number=$2 WHERE purchase_order_id=$3 AND (supplier_invoice_id IS NULL OR supplier_invoice_id=$1)`,
      [result.rows[0].id, result.rows[0].invoice_number, poId],
    );
    await client.query("COMMIT");
    return res.status(id ? 200 : 201).json({
      success: true,
      message: id
        ? "Tagihan supplier berhasil diperbarui"
        : "Tagihan supplier berhasil dibuat",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    await Promise.all(
      stored.map((item) => remove(item.storageName)),
    );
    const duplicate = error.code === "23505";
    return res
      .status(duplicate ? 409 : error.statusCode || 500)
      .json({
        success: false,
        message: duplicate
          ? "Purchase order sudah memiliki tagihan supplier"
          : error.message || "Tagihan supplier gagal disimpan",
      });
  } finally {
    client.release();
  }
};

const deleteAttachment = async (req, res) => {
  const result = await pool.query(
    `DELETE FROM app.supplier_invoice_attachments WHERE id=$1 AND supplier_invoice_id=$2 RETURNING storage_name`,
    [req.params.attachmentId, req.params.id],
  );
  if (!result.rows.length) {
    return res.status(404).json({
      success: false,
      message: "Lampiran tidak ditemukan",
    });
  }
  await remove(result.rows[0].storage_name);
  return res.json({
    success: true,
    message: "Lampiran berhasil dihapus",
  });
};

const serveAttachment = async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM app.supplier_invoice_attachments WHERE id=$1 AND supplier_invoice_id=$2`,
    [req.params.attachmentId, req.params.id],
  );
  if (
    !result.rows.length ||
    !(await stream(res, result.rows[0]))
  ) {
    return res.status(404).json({
      success: false,
      message: "Lampiran tidak ditemukan",
    });
  }
};

module.exports = {
  listSupplierInvoices,
  getSupplierInvoice,
  saveSupplierInvoice,
  deleteAttachment,
  serveAttachment,
};
