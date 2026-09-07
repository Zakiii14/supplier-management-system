const pool = require("../config/database");
const { resolveCodeNumber } = require("../services/codeNumberService");
const {
  removeStoredProofFiles,
  serializeProof,
  storeAndInsertProofs,
} = require("../services/paymentProofService");

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "GIRO", "OTHER"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidDate = (value) => {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

const getSupplierPaymentProofs = async (client, paymentId) => {
  const result = await client.query(
    `
    SELECT pp.*, u.full_name AS uploaded_by_name
    FROM app.payment_proofs pp
    LEFT JOIN app.users u ON u.id = pp.uploaded_by
    WHERE pp.supplier_payment_id = $1
    ORDER BY pp.created_at ASC
    `,
    [paymentId],
  );

  return result.rows.map(serializeProof);
};

const createSupplierPayment = async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;
  let storedProofs = [];

  try {
    const purchaseOrderId = req.params.purchaseOrderId;
    const paymentNumber =
      typeof req.body.payment_number === "string"
        ? req.body.payment_number.trim().toUpperCase()
        : "";
    const paymentDate =
      typeof req.body.payment_date === "string"
        ? req.body.payment_date.trim()
        : "";
    const method =
      typeof req.body.method === "string"
        ? req.body.method.trim().toUpperCase()
        : "";
    const referenceNumber =
      typeof req.body.reference_number === "string"
        ? req.body.reference_number.trim()
        : "";
    const supplierInvoiceNumber =
      typeof req.body.supplier_invoice_number === "string"
        ? req.body.supplier_invoice_number.trim()
        : "";
    const notes =
      typeof req.body.notes === "string" ? req.body.notes.trim() : "";
    const amount = Number(req.body.amount);
    const files = req.files || [];

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Nominal pembayaran harus lebih dari nol",
      });
    }

    if (!PAYMENT_METHODS.includes(method)) {
      return res.status(400).json({
        success: false,
        message: "Metode pembayaran tidak valid",
      });
    }

    if (paymentDate && !isValidDate(paymentDate)) {
      return res.status(400).json({
        success: false,
        message: "Tanggal pembayaran tidak valid",
      });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const settingsResult = await client.query(
      `
      SELECT require_purchase_transfer_proof
      FROM app.payment_settings
      WHERE id = 1
      `,
    );

    if (
      settingsResult.rows[0]?.require_purchase_transfer_proof &&
      ["BANK_TRANSFER", "GIRO"].includes(method) &&
      files.length === 0
    ) {
      const error = new Error(
        "Bukti pembayaran wajib untuk transfer bank atau giro",
      );
      error.statusCode = 400;
      throw error;
    }

    const purchaseOrderResult = await client.query(
      `
      SELECT id, po_number, order_date, status
      FROM app.purchase_orders
      WHERE id = $1
      FOR UPDATE
      `,
      [purchaseOrderId],
    );

    if (!purchaseOrderResult.rows.length) {
      const error = new Error("Purchase order not found");
      error.statusCode = 404;
      throw error;
    }

    const purchaseOrder = purchaseOrderResult.rows[0];

    if (!["SUBMITTED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(
      purchaseOrder.status,
    )) {
      const error = new Error(
        "Pembayaran hanya dapat dicatat setelah purchase order diajukan",
      );
      error.statusCode = 409;
      throw error;
    }

    const dateResult = await client.query(
      `
      SELECT COALESCE($1::DATE, CURRENT_DATE) < $2::DATE AS invalid_date
      `,
      [paymentDate || null, purchaseOrder.order_date],
    );

    if (dateResult.rows[0].invalid_date) {
      const error = new Error(
        "Tanggal pembayaran tidak boleh lebih awal dari tanggal PO",
      );
      error.statusCode = 400;
      throw error;
    }

    let supplierInvoiceId = null;
    let invoiceOutstanding = null;
    if (supplierInvoiceNumber) {
      const invoiceResult = await client.query(
        `SELECT si.id, si.total_amount-COALESCE((
           SELECT SUM(sp.amount) FROM app.supplier_payments sp
           WHERE sp.supplier_invoice_id=si.id
         ),0) AS outstanding
         FROM app.supplier_invoices si
         WHERE si.purchase_order_id=$1 AND LOWER(si.invoice_number)=LOWER($2)
         FOR UPDATE`,
        [purchaseOrderId, supplierInvoiceNumber],
      );
      if (!invoiceResult.rows.length) {
        const error = new Error("Invoice supplier belum terdaftar pada purchase order ini");
        error.statusCode = 400;
        throw error;
      }
      supplierInvoiceId = invoiceResult.rows[0].id;
      invoiceOutstanding = Number(invoiceResult.rows[0].outstanding);
    }

    const totalsResult = await client.query(
      `
      SELECT
        COALESCE((
          SELECT SUM(quantity * unit_price)
          FROM app.purchase_order_items
          WHERE purchase_order_id = $1
        ), 0) AS total_amount,
        COALESCE((
          SELECT SUM(amount)
          FROM app.supplier_payments
          WHERE purchase_order_id = $1
        ), 0) AS paid_amount
      `,
      [purchaseOrderId],
    );

    const totalAmount = Number(totalsResult.rows[0].total_amount);
    const paidAmount = Number(totalsResult.rows[0].paid_amount);

    if (invoiceOutstanding !== null && amount > invoiceOutstanding) {
      const error = new Error(`Nominal pembayaran melebihi sisa invoice (${invoiceOutstanding})`);
      error.statusCode = 400;
      throw error;
    }

    if (amount > totalAmount - paidAmount) {
      const error = new Error(
        `Nominal pembayaran melebihi sisa tagihan (${totalAmount - paidAmount})`,
      );
      error.statusCode = 400;
      throw error;
    }

    const resolvedPaymentNumber = await resolveCodeNumber({
      client,
      moduleKey: "SUPPLIER_PAYMENT",
      manualCode: paymentNumber,
    });

    const paymentResult = await client.query(
      `
      INSERT INTO app.supplier_payments (
        payment_number,
        purchase_order_id,
        payment_date,
        amount,
        method,
        reference_number,
        supplier_invoice_number,
        supplier_invoice_id,
        notes,
        paid_by
      )
      VALUES (
        $1,
        $2,
        COALESCE($3::DATE, CURRENT_DATE),
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10
      )
      RETURNING *
      `,
      [
        resolvedPaymentNumber,
        purchaseOrderId,
        paymentDate || null,
        amount,
        method,
        referenceNumber || null,
        supplierInvoiceNumber || null,
        supplierInvoiceId,
        notes || null,
        req.user.id,
      ],
    );

    const payment = paymentResult.rows[0];

    storedProofs = await storeAndInsertProofs({
      client,
      files,
      ownerColumn: "supplier_payment_id",
      ownerId: payment.id,
      uploadedBy: req.user.id,
    });

    await client.query("COMMIT");
    transactionStarted = false;

    res.status(201).json({
      success: true,
      message: "Pembayaran supplier berhasil dicatat",
      data: {
        ...payment,
        proofs: await getSupplierPaymentProofs(client, payment.id),
      },
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    if (storedProofs.length) {
      await removeStoredProofFiles(storedProofs);
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Nomor pembayaran supplier sudah digunakan",
      });
    }

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid purchase order ID",
      });
    }

    console.error("Error creating supplier payment:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Pembayaran supplier gagal dicatat",
    });
  } finally {
    client.release();
  }
};

module.exports = {
  createSupplierPayment,
};
