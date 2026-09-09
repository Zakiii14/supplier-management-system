const pool = require("../config/database");
const { resolveCodeNumber } = require("../services/codeNumberService");
const { parseDateRange } = require("../utils/dateRange");

const STATUSES = new Set(["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"]);

const normalizeText = (value, maxLength = 1000) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const parseQuantity = (value) => {
  const quantity = Number(value);
  return Number.isFinite(quantity) &&
    quantity >= 0 &&
    Math.abs(quantity * 1000 - Math.round(quantity * 1000)) < 1e-8
    ? quantity
    : null;
};

const parseOpnameDate = (value) => {
  const normalized = normalizeText(value, 10);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized
    ? undefined
    : normalized;
};

const mapDatabaseError = (error, fallback) => {
  if (error.code === "22P02") return { status: 400, message: "ID atau nilai data tidak valid" };
  if (error.code === "23505") return { status: 409, message: "Nomor stock opname atau produk sudah digunakan" };
  if (error.statusCode) return { status: error.statusCode, message: error.message };
  return { status: 500, message: fallback };
};

const getStockOpnameDetail = async (queryable, id) => {
  const header = await queryable.query(
    `SELECT so.*, creator.full_name AS created_by_name,
            submitter.full_name AS submitted_by_name,
            decider.full_name AS decided_by_name,
            COUNT(soi.id)::INTEGER AS item_count,
            COALESCE(SUM(ABS(soi.counted_quantity-soi.system_quantity)),0) AS total_variance
     FROM app.stock_opnames so
     LEFT JOIN app.users creator ON creator.id=so.created_by
     LEFT JOIN app.users submitter ON submitter.id=so.submitted_by
     LEFT JOIN app.users decider ON decider.id=so.decided_by
     LEFT JOIN app.stock_opname_items soi ON soi.stock_opname_id=so.id
     WHERE so.id=$1
     GROUP BY so.id,creator.full_name,submitter.full_name,decider.full_name`,
    [id],
  );
  if (!header.rows.length) return null;

  const [items, history] = await Promise.all([
    queryable.query(
      `SELECT soi.id,soi.product_id,p.sku,p.product_name,p.unit,
              soi.system_quantity,soi.counted_quantity,
              soi.counted_quantity-soi.system_quantity AS variance,soi.notes
       FROM app.stock_opname_items soi
       JOIN app.products p ON p.id=soi.product_id
       WHERE soi.stock_opname_id=$1 ORDER BY p.product_name`,
      [id],
    ),
    queryable.query(
      `SELECT ta.id,ta.action,ta.reason,ta.acted_at,
              u.full_name AS acted_by_name,u.role AS acted_by_role
       FROM app.transaction_approvals ta
       LEFT JOIN app.users u ON u.id=ta.acted_by
       WHERE ta.transaction_type='STOCK_OPNAME' AND ta.transaction_id=$1
       ORDER BY ta.acted_at DESC`,
      [id],
    ),
  ]);

  return { ...header.rows[0], items: items.rows, approval_history: history.rows };
};

const getAllStockOpnames = async (req, res) => {
  try {
    const { search = "", status = "", date_from = "", date_to = "", page = 1, limit = 10 } = req.query;
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedPage) || parsedPage < 1 || !Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({ success: false, message: "Parameter pagination tidak valid" });
    }
    const normalizedStatus = normalizeText(status, 20).toUpperCase();
    if (normalizedStatus && !STATUSES.has(normalizedStatus)) {
      return res.status(400).json({ success: false, message: "Status stock opname tidak valid" });
    }
    const { dateFrom, dateTo, error } = parseDateRange(date_from, date_to);
    if (error) return res.status(400).json({ success: false, message: error });

    const values = [];
    const conditions = [];
    if (normalizeText(search)) {
      values.push(`%${normalizeText(search)}%`);
      conditions.push(`(so.opname_number ILIKE $${values.length} OR COALESCE(so.notes,'') ILIKE $${values.length} OR COALESCE(u.full_name,'') ILIKE $${values.length})`);
    }
    if (normalizedStatus) {
      values.push(normalizedStatus);
      conditions.push(`so.status=$${values.length}`);
    }
    if (dateFrom) {
      values.push(dateFrom);
      conditions.push(`so.opname_date >= $${values.length}::date`);
    }
    if (dateTo) {
      values.push(dateTo);
      conditions.push(`so.opname_date <= $${values.length}::date`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const count = await pool.query(`SELECT COUNT(*)::INTEGER AS total FROM app.stock_opnames so LEFT JOIN app.users u ON u.id=so.created_by ${where}`, values);
    const queryValues = [...values, parsedLimit, (parsedPage - 1) * parsedLimit];
    const result = await pool.query(
      `SELECT so.id,so.opname_number,so.opname_date,so.status,so.notes,
              so.created_by,so.submitted_by,so.created_at,so.updated_at,
              u.full_name AS created_by_name,COUNT(soi.id)::INTEGER AS item_count,
              COALESCE(SUM(CASE WHEN soi.counted_quantity<>soi.system_quantity THEN 1 ELSE 0 END),0)::INTEGER AS variance_item_count,
              COALESCE(SUM(ABS(soi.counted_quantity-soi.system_quantity)),0) AS total_variance
       FROM app.stock_opnames so
       LEFT JOIN app.users u ON u.id=so.created_by
       LEFT JOIN app.stock_opname_items soi ON soi.stock_opname_id=so.id
       ${where}
       GROUP BY so.id,u.full_name
       ORDER BY so.opname_date DESC,so.created_at DESC
       LIMIT $${queryValues.length - 1} OFFSET $${queryValues.length}`,
      queryValues,
    );
    const total = count.rows[0].total;
    return res.json({ success: true, data: result.rows, pagination: { page: parsedPage, limit: parsedLimit, total, total_pages: Math.ceil(total / parsedLimit) } });
  } catch (error) {
    console.error("Error fetching stock opnames:", error);
    return res.status(500).json({ success: false, message: "Stock opname gagal dimuat" });
  }
};

const getStockOpnameById = async (req, res) => {
  try {
    const detail = await getStockOpnameDetail(pool, req.params.id);
    if (!detail) return res.status(404).json({ success: false, message: "Stock opname tidak ditemukan" });
    return res.json({ success: true, data: detail });
  } catch (error) {
    const mapped = mapDatabaseError(error, "Detail stock opname gagal dimuat");
    return res.status(mapped.status).json({ success: false, message: mapped.message });
  }
};

const createStockOpname = async (req, res) => {
  const client = await pool.connect();
  try {
    const opnameDate = parseOpnameDate(req.body.opname_date);
    if (opnameDate === undefined) {
      return res.status(400).json({ success: false, message: "Tanggal penghitungan tidak valid" });
    }
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length || items.length > 100) return res.status(400).json({ success: false, message: "Stock opname harus memiliki 1 sampai 100 produk" });
    const uniqueIds = new Set();
    const normalizedItems = [];
    for (const item of items) {
      const productId = normalizeText(item.product_id, 50);
      const countedQuantity = parseQuantity(item.counted_quantity);
      if (!productId || countedQuantity === null) return res.status(400).json({ success: false, message: "Produk dan jumlah fisik harus diisi dengan benar" });
      if (uniqueIds.has(productId)) return res.status(400).json({ success: false, message: "Produk tidak boleh dicatat lebih dari sekali" });
      uniqueIds.add(productId);
      normalizedItems.push({ productId, countedQuantity, notes: normalizeText(item.notes, 300) || null });
    }

    await client.query("BEGIN");
    const products = await client.query(
      `SELECT id,current_stock FROM app.products WHERE id=ANY($1::uuid[]) AND status='ACTIVE' FOR SHARE`,
      [[...uniqueIds]],
    );
    if (products.rows.length !== uniqueIds.size) {
      const error = new Error("Salah satu produk tidak ditemukan atau sudah tidak aktif");
      error.statusCode = 400;
      throw error;
    }
    const stockByProduct = new Map(products.rows.map((row) => [row.id, row.current_stock]));
    const opnameNumber = await resolveCodeNumber({ client, moduleKey: "STOCK_OPNAME", manualCode: req.body.opname_number });
    const header = await client.query(
      `INSERT INTO app.stock_opnames(opname_number,opname_date,notes,created_by)
       VALUES($1,COALESCE($2::date,CURRENT_DATE),$3,$4) RETURNING *`,
      [opnameNumber, opnameDate, normalizeText(req.body.notes, 1000) || null, req.user.id],
    );
    for (const item of normalizedItems) {
      await client.query(
        `INSERT INTO app.stock_opname_items(stock_opname_id,product_id,system_quantity,counted_quantity,notes)
         VALUES($1,$2,$3,$4,$5)`,
        [header.rows[0].id, item.productId, stockByProduct.get(item.productId), item.countedQuantity, item.notes],
      );
    }
    await client.query("COMMIT");
    const detail = await getStockOpnameDetail(pool, header.rows[0].id);
    return res.status(201).json({ success: true, message: "Stock opname berhasil disimpan sebagai draft", data: detail });
  } catch (error) {
    await client.query("ROLLBACK");
    const mapped = mapDatabaseError(error, "Stock opname gagal disimpan");
    return res.status(mapped.status).json({ success: false, message: mapped.message });
  } finally {
    client.release();
  }
};

const submitStockOpname = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(`SELECT * FROM app.stock_opnames WHERE id=$1 FOR UPDATE`, [req.params.id]);
    if (!current.rows.length) { const error = new Error("Stock opname tidak ditemukan"); error.statusCode = 404; throw error; }
    if (current.rows[0].status !== "DRAFT") { const error = new Error("Hanya stock opname draft yang dapat diajukan"); error.statusCode = 409; throw error; }
    const result = await client.query(
      `UPDATE app.stock_opnames SET status='PENDING',submitted_by=$1,submitted_at=NOW(),decided_by=NULL,decided_at=NULL,rejection_reason=NULL WHERE id=$2 RETURNING *`,
      [req.user.id, req.params.id],
    );
    await client.query(`INSERT INTO app.transaction_approvals(transaction_type,transaction_id,action,acted_by) VALUES('STOCK_OPNAME',$1,'SUBMITTED',$2)`, [req.params.id, req.user.id]);
    await client.query("COMMIT");
    return res.json({ success: true, message: "Stock opname berhasil diajukan", data: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    const mapped = mapDatabaseError(error, "Stock opname gagal diajukan");
    return res.status(mapped.status).json({ success: false, message: mapped.message });
  } finally { client.release(); }
};

const decideStockOpname = async (req, res) => {
  const client = await pool.connect();
  try {
    const decision = normalizeText(req.body.decision, 20).toUpperCase();
    const reason = normalizeText(req.body.reason, 500);
    if (!['APPROVED','REJECTED'].includes(decision)) return res.status(400).json({ success: false, message: "Keputusan harus APPROVED atau REJECTED" });
    if (decision === 'REJECTED' && reason.length < 5) return res.status(400).json({ success: false, message: "Alasan penolakan minimal 5 karakter" });
    await client.query("BEGIN");
    const current = await client.query(`SELECT * FROM app.stock_opnames WHERE id=$1 FOR UPDATE`, [req.params.id]);
    if (!current.rows.length) { const error = new Error("Stock opname tidak ditemukan"); error.statusCode = 404; throw error; }
    if (current.rows[0].status !== 'PENDING') { const error = new Error("Stock opname sudah tidak menunggu persetujuan"); error.statusCode = 409; throw error; }
    if (current.rows[0].submitted_by === req.user.id) { const error = new Error("Pengaju tidak dapat memutuskan stock opname sendiri"); error.statusCode = 403; throw error; }

    if (decision === 'APPROVED') {
      const items = await client.query(
        `SELECT soi.*,p.current_stock,p.product_name FROM app.stock_opname_items soi
         JOIN app.products p ON p.id=soi.product_id WHERE soi.stock_opname_id=$1
         ORDER BY soi.id FOR UPDATE OF p`,
        [req.params.id],
      );
      for (const item of items.rows) {
        if (Number(item.current_stock) !== Number(item.system_quantity)) {
          const error = new Error(`Stok ${item.product_name} berubah setelah penghitungan. Buat stock opname baru.`);
          error.statusCode = 409;
          throw error;
        }
      }
      for (const item of items.rows) {
        const variance = Number(item.counted_quantity) - Number(item.system_quantity);
        if (variance !== 0) {
          await client.query(
            `INSERT INTO app.inventory_movements(product_id,movement_type,quantity,reference_type,reference_id,notes,created_by)
             VALUES($1,$2,$3,'STOCK_OPNAME',$4,$5,$6)`,
            [item.product_id, variance > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', Math.abs(variance), req.params.id, `Penyesuaian dari ${current.rows[0].opname_number}`, req.user.id],
          );
          await client.query(`UPDATE app.products SET current_stock=$1,updated_at=NOW() WHERE id=$2`, [item.counted_quantity, item.product_id]);
        }
      }
    }
    const result = await client.query(
      `UPDATE app.stock_opnames SET status=$1,decided_by=$2,decided_at=NOW(),rejection_reason=$3 WHERE id=$4 RETURNING *`,
      [decision, req.user.id, decision === 'REJECTED' ? reason : null, req.params.id],
    );
    await client.query(
      `INSERT INTO app.transaction_approvals(transaction_type,transaction_id,action,reason,acted_by) VALUES('STOCK_OPNAME',$1,$2,$3,$4)`,
      [req.params.id, decision, decision === 'REJECTED' ? reason : null, req.user.id],
    );
    await client.query("COMMIT");
    return res.json({ success: true, message: decision === 'APPROVED' ? "Stock opname disetujui dan stok telah disesuaikan" : "Stock opname ditolak", data: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    const mapped = mapDatabaseError(error, "Keputusan stock opname gagal disimpan");
    return res.status(mapped.status).json({ success: false, message: mapped.message });
  } finally { client.release(); }
};

const cancelStockOpname = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE app.stock_opnames SET status='CANCELLED' WHERE id=$1 AND status IN ('DRAFT','REJECTED') RETURNING *`,
      [req.params.id],
    );
    if (!result.rows.length) return res.status(409).json({ success: false, message: "Stock opname tidak dapat dibatalkan" });
    return res.json({ success: true, message: "Stock opname dibatalkan", data: result.rows[0] });
  } catch (error) {
    const mapped = mapDatabaseError(error, "Stock opname gagal dibatalkan");
    return res.status(mapped.status).json({ success: false, message: mapped.message });
  }
};

module.exports = { getAllStockOpnames, getStockOpnameById, createStockOpname, submitStockOpname, decideStockOpname, cancelStockOpname };
