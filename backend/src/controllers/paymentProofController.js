const pool = require("../config/database");
const {
  MAX_PROOF_FILES,
  removeStoredProofFile,
  serializeProof,
  storeAndInsertProofs,
  storeProofFile,
  streamStoredProof,
} = require("../services/paymentProofService");

const OWNER_CONFIG = {
  customer: {
    ownerColumn: "customer_payment_id",
    ownerTable: "payments",
    parentColumn: null,
  },
  supplier: {
    ownerColumn: "supplier_payment_id",
    ownerTable: "supplier_payments",
    parentColumn: "purchase_order_id",
  },
};

const getContext = (req, kind) => {
  const config = OWNER_CONFIG[kind];

  return {
    ...config,
    ownerId: kind === "customer" ? req.params.id : req.params.paymentId,
    parentId: kind === "supplier" ? req.params.purchaseOrderId : null,
    proofId: req.params.proofId,
  };
};

const findOwner = async (client, context) => {
  const conditions = ["id = $1"];
  const values = [context.ownerId];

  if (context.parentColumn) {
    values.push(context.parentId);
    conditions.push(`${context.parentColumn} = $2`);
  }

  const result = await client.query(
    `
    SELECT id
    FROM app.${context.ownerTable}
    WHERE ${conditions.join(" AND ")}
    `,
    values,
  );

  return result.rows[0] || null;
};

const listProofs = async (client, context) => {
  const result = await client.query(
    `
    SELECT
      pp.*,
      u.full_name AS uploaded_by_name
    FROM app.payment_proofs pp
    LEFT JOIN app.users u
      ON u.id = pp.uploaded_by
    WHERE pp.${context.ownerColumn} = $1
    ORDER BY pp.created_at ASC
    `,
    [context.ownerId],
  );

  return result.rows.map(serializeProof);
};

const addProofs = (kind) => async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;
  let storedProofs = [];

  try {
    const context = getContext(req, kind);
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "Pilih minimal satu bukti pembayaran",
      });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    if (!(await findOwner(client, context))) {
      const error = new Error("Payment not found");
      error.statusCode = 404;
      throw error;
    }

    const countResult = await client.query(
      `
      SELECT COUNT(*)::INTEGER AS total
      FROM app.payment_proofs
      WHERE ${context.ownerColumn} = $1
      `,
      [context.ownerId],
    );

    if (countResult.rows[0].total + files.length > MAX_PROOF_FILES) {
      const error = new Error(
        `Maksimal ${MAX_PROOF_FILES} bukti untuk setiap pembayaran`,
      );
      error.statusCode = 400;
      throw error;
    }

    storedProofs = await storeAndInsertProofs({
      client,
      files,
      ownerColumn: context.ownerColumn,
      ownerId: context.ownerId,
      uploadedBy: req.user.id,
    });

    await client.query("COMMIT");
    transactionStarted = false;

    res.status(201).json({
      success: true,
      message: "Bukti pembayaran berhasil ditambahkan",
      data: await listProofs(client, context),
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    if (storedProofs.length) {
      await Promise.all(
        storedProofs.map((proof) =>
          removeStoredProofFile(proof.storageName),
        ),
      );
    }

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid payment or proof ID",
      });
    }

    console.error("Error adding payment proofs:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Bukti pembayaran gagal ditambahkan",
    });
  } finally {
    client.release();
  }
};

const replaceProof = (kind) => async (req, res) => {
  const client = await pool.connect();
  let newStored = null;
  let transactionStarted = false;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Pilih file pengganti",
      });
    }

    const context = getContext(req, kind);

    await client.query("BEGIN");
    transactionStarted = true;

    if (!(await findOwner(client, context))) {
      const error = new Error("Payment not found");
      error.statusCode = 404;
      throw error;
    }

    const currentResult = await client.query(
      `
      SELECT *
      FROM app.payment_proofs
      WHERE id = $1
        AND ${context.ownerColumn} = $2
      FOR UPDATE
      `,
      [context.proofId, context.ownerId],
    );

    if (!currentResult.rows.length) {
      const error = new Error("Payment proof not found");
      error.statusCode = 404;
      throw error;
    }

    newStored = await storeProofFile(req.file);

    await client.query(
      `
      UPDATE app.payment_proofs
      SET
        original_name = $1,
        storage_name = $2,
        mime_type = $3,
        size_bytes = $4,
        checksum_sha256 = $5,
        uploaded_by = $6
      WHERE id = $7
      `,
      [
        newStored.originalName,
        newStored.storageName,
        newStored.mimeType,
        newStored.sizeBytes,
        newStored.checksum,
        req.user.id,
        context.proofId,
      ],
    );

    await client.query("COMMIT");
    transactionStarted = false;

    try {
      await removeStoredProofFile(currentResult.rows[0].storage_name);
    } catch (cleanupError) {
      console.error("Error removing replaced payment proof:", cleanupError);
    }
    newStored = null;

    res.status(200).json({
      success: true,
      message: "Bukti pembayaran berhasil diganti",
      data: await listProofs(client, context),
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    if (newStored) {
      await removeStoredProofFile(newStored.storageName);
    }

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid payment or proof ID",
      });
    }

    console.error("Error replacing payment proof:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Bukti pembayaran gagal diganti",
    });
  } finally {
    client.release();
  }
};

const deleteProof = (kind) => async (req, res) => {
  try {
    const context = getContext(req, kind);
    const owner = await findOwner(pool, context);

    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM app.payment_proofs
      WHERE id = $1
        AND ${context.ownerColumn} = $2
      RETURNING storage_name
      `,
      [context.proofId, context.ownerId],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Payment proof not found",
      });
    }

    await removeStoredProofFile(result.rows[0].storage_name);

    res.status(200).json({
      success: true,
      message: "Bukti pembayaran berhasil dihapus",
      data: await listProofs(pool, context),
    });
  } catch (error) {
    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid payment or proof ID",
      });
    }

    console.error("Error deleting payment proof:", error);
    res.status(500).json({
      success: false,
      message: "Bukti pembayaran gagal dihapus",
    });
  }
};

const serveProof = (kind) => async (req, res) => {
  try {
    const context = getContext(req, kind);

    if (!(await findOwner(pool, context))) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM app.payment_proofs
      WHERE id = $1
        AND ${context.ownerColumn} = $2
      `,
      [context.proofId, context.ownerId],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Payment proof not found",
      });
    }

    if (
      !streamStoredProof(
        res,
        result.rows[0],
        req.query.download === "1",
      )
    ) {
      return res.status(404).json({
        success: false,
        message: "Payment proof file not found",
      });
    }
  } catch (error) {
    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid payment or proof ID",
      });
    }

    console.error("Error serving payment proof:", error);
    res.status(500).json({
      success: false,
      message: "Bukti pembayaran gagal dibuka",
    });
  }
};

module.exports = {
  addCustomerPaymentProofs: addProofs("customer"),
  addSupplierPaymentProofs: addProofs("supplier"),
  deleteCustomerPaymentProof: deleteProof("customer"),
  deleteSupplierPaymentProof: deleteProof("supplier"),
  replaceCustomerPaymentProof: replaceProof("customer"),
  replaceSupplierPaymentProof: replaceProof("supplier"),
  serveCustomerPaymentProof: serveProof("customer"),
  serveSupplierPaymentProof: serveProof("supplier"),
};
