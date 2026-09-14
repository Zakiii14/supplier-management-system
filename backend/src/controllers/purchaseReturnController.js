const pool = require("../config/database");
const { resolveCodeNumber } = require("../services/codeNumberService");
const { parseDateRange } = require("../utils/dateRange");

const STATUSES = new Set(["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"]);
const REASONS = new Set(["DAMAGED", "WRONG_ITEM", "QUALITY_ISSUE", "EXCESS", "OTHER"]);
const CONDITIONS = new Set(["DAMAGED", "WRONG_ITEM", "QUALITY_ISSUE", "UNOPENED", "OTHER"]);
const SETTLEMENT_TYPES = new Set(["INVOICE_DEDUCTION", "REFUND", "REPLACEMENT", "SUPPLIER_CREDIT"]);

const normalizeText = (value, maxLength = 1000) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const parseQuantity = (value) => {
  const quantity = Number(value);
  return Number.isFinite(quantity) &&
    quantity > 0 &&
    Math.abs(quantity * 1000 - Math.round(quantity * 1000)) < 1e-8
    ? quantity
    : null;
};

const parseReturnDate = (value) => {
  const normalized = normalizeText(value, 10);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized
    ? undefined
    : normalized;
};

const makeError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const mapDatabaseError = (error, fallback) => {
  if (error.code === "22P02") return { status: 400, message: "ID atau nilai data tidak valid" };
  if (error.code === "23505") return { status: 409, message: "Nomor retur atau produk sudah digunakan" };
  if (error.code === "23503") return { status: 400, message: "Referensi penerimaan atau produk tidak valid" };
  if (error.statusCode) return { status: error.statusCode, message: error.message };
  return { status: 500, message: fallback };
};

const getPurchaseReturnDetail = async (queryable, id) => {
  const header = await queryable.query(
    `SELECT pr.*,gr.receipt_number,gr.received_date,po.id AS purchase_order_id,
            po.po_number,s.id AS supplier_id,s.supplier_code,s.supplier_name,
            creator.full_name AS created_by_name,submitter.full_name AS submitted_by_name,
            decider.full_name AS decided_by_name,COUNT(pri.id)::INTEGER AS item_count,
            COALESCE(SUM(pri.quantity),0) AS total_quantity,
            COALESCE(SUM(pri.quantity*pri.unit_price),0) AS total_amount,
            COALESCE((SELECT SUM(prs.amount) FROM app.purchase_return_settlements prs WHERE prs.purchase_return_id=pr.id),0) AS settled_amount,
            GREATEST(COALESCE(SUM(pri.quantity*pri.unit_price),0)-COALESCE((SELECT SUM(prs.amount) FROM app.purchase_return_settlements prs WHERE prs.purchase_return_id=pr.id),0),0) AS settlement_remaining
     FROM app.purchase_returns pr
     JOIN app.goods_receipts gr ON gr.id=pr.goods_receipt_id
     JOIN app.purchase_orders po ON po.id=gr.purchase_order_id
     JOIN app.suppliers s ON s.id=po.supplier_id
     LEFT JOIN app.users creator ON creator.id=pr.created_by
     LEFT JOIN app.users submitter ON submitter.id=pr.submitted_by
     LEFT JOIN app.users decider ON decider.id=pr.decided_by
     LEFT JOIN app.purchase_return_items pri ON pri.purchase_return_id=pr.id
     WHERE pr.id=$1
     GROUP BY pr.id,gr.receipt_number,gr.received_date,po.id,po.po_number,
              s.id,s.supplier_code,s.supplier_name,creator.full_name,
              submitter.full_name,decider.full_name`,
    [id],
  );
  if (!header.rows.length) return null;

  const [items, history, settlements] = await Promise.all([
    queryable.query(
      `SELECT pri.id,pri.product_id,p.sku,p.product_name,p.unit,pri.quantity,
              pri.unit_price,pri.quantity*pri.unit_price AS subtotal,
              pri.item_condition,pri.notes
       FROM app.purchase_return_items pri
       JOIN app.products p ON p.id=pri.product_id
       WHERE pri.purchase_return_id=$1 ORDER BY p.product_name`,
      [id],
    ),
    queryable.query(
      `SELECT ta.id,ta.action,ta.reason,ta.acted_at,
              u.full_name AS acted_by_name,u.role AS acted_by_role
       FROM app.transaction_approvals ta
       LEFT JOIN app.users u ON u.id=ta.acted_by
       WHERE ta.transaction_type='PURCHASE_RETURN' AND ta.transaction_id=$1
       ORDER BY ta.acted_at DESC`,
      [id],
    ),
    queryable.query(
      `SELECT prs.id,prs.settlement_type,prs.settlement_date,prs.amount,
              prs.reference_number,prs.notes,prs.created_at,
              si.invoice_number,u.full_name AS created_by_name
       FROM app.purchase_return_settlements prs
       LEFT JOIN app.supplier_invoices si ON si.id=prs.supplier_invoice_id
       LEFT JOIN app.users u ON u.id=prs.created_by
       WHERE prs.purchase_return_id=$1
       ORDER BY prs.settlement_date DESC,prs.created_at DESC`,
      [id],
    ),
  ]);

  const detail = header.rows[0];
  const totalAmount = Number(detail.total_amount);
  const settledAmount = Number(detail.settled_amount);
  return {
    ...detail,
    settlement_status: settledAmount <= 0 ? "UNSETTLED" : settledAmount >= totalAmount ? "SETTLED" : "PARTIAL",
    items: items.rows,
    approval_history: history.rows,
    settlements: settlements.rows,
  };
};

const getAllPurchaseReturns = async (req, res) => {
  try {
    const { search = "", status = "", date_from = "", date_to = "", page = 1, limit = 10 } = req.query;
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedPage) || parsedPage < 1 || !Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({ success: false, message: "Parameter pagination tidak valid" });
    }
    const normalizedStatus = normalizeText(status, 20).toUpperCase();
    if (normalizedStatus && !STATUSES.has(normalizedStatus)) {
      return res.status(400).json({ success: false, message: "Status retur pembelian tidak valid" });
    }
    const { dateFrom, dateTo, error } = parseDateRange(date_from, date_to);
    if (error) return res.status(400).json({ success: false, message: error });

    const values = [];
    const conditions = [];
    const normalizedSearch = normalizeText(search, 120);
    if (normalizedSearch) {
      values.push(`%${normalizedSearch}%`);
      conditions.push(`(pr.return_number ILIKE $${values.length} OR gr.receipt_number ILIKE $${values.length} OR po.po_number ILIKE $${values.length} OR s.supplier_name ILIKE $${values.length} OR COALESCE(pr.notes,'') ILIKE $${values.length})`);
    }
    if (normalizedStatus) {
      values.push(normalizedStatus);
      conditions.push(`pr.status=$${values.length}`);
    }
    if (dateFrom) {
      values.push(dateFrom);
      conditions.push(`pr.return_date >= $${values.length}::date`);
    }
    if (dateTo) {
      values.push(dateTo);
      conditions.push(`pr.return_date <= $${values.length}::date`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const from = `FROM app.purchase_returns pr JOIN app.goods_receipts gr ON gr.id=pr.goods_receipt_id JOIN app.purchase_orders po ON po.id=gr.purchase_order_id JOIN app.suppliers s ON s.id=po.supplier_id LEFT JOIN app.users u ON u.id=pr.created_by`;
    const count = await pool.query(`SELECT COUNT(*)::INTEGER AS total ${from} ${where}`, values);
    const queryValues = [...values, parsedLimit, (parsedPage - 1) * parsedLimit];
    const result = await pool.query(
      `SELECT pr.id,pr.return_number,pr.return_date,pr.status,pr.reason,pr.notes,
              pr.created_by,pr.submitted_by,pr.created_at,pr.updated_at,
              gr.receipt_number,po.po_number,s.supplier_code,s.supplier_name,
              u.full_name AS created_by_name,COUNT(pri.id)::INTEGER AS item_count,
              COALESCE(SUM(pri.quantity),0) AS total_quantity,
              COALESCE(SUM(pri.quantity*pri.unit_price),0) AS total_amount,
              COALESCE((SELECT SUM(prs.amount) FROM app.purchase_return_settlements prs WHERE prs.purchase_return_id=pr.id),0) AS settled_amount
       ${from} LEFT JOIN app.purchase_return_items pri ON pri.purchase_return_id=pr.id
       ${where}
       GROUP BY pr.id,gr.receipt_number,po.po_number,s.supplier_code,s.supplier_name,u.full_name
       ORDER BY pr.return_date DESC,pr.created_at DESC
       LIMIT $${queryValues.length - 1} OFFSET $${queryValues.length}`,
      queryValues,
    );
    const total = count.rows[0].total;
    return res.json({ success: true, data: result.rows, pagination: { page: parsedPage, limit: parsedLimit, total, total_pages: Math.ceil(total / parsedLimit) } });
  } catch (error) {
    console.error("Error fetching purchase returns:", error);
    return res.status(500).json({ success: false, message: "Retur pembelian gagal dimuat" });
  }
};

const getPurchaseReturnById = async (req, res) => {
  try {
    const detail = await getPurchaseReturnDetail(pool, req.params.id);
    if (!detail) return res.status(404).json({ success: false, message: "Retur pembelian tidak ditemukan" });
    return res.json({ success: true, data: detail });
  } catch (error) {
    const mapped = mapDatabaseError(error, "Detail retur pembelian gagal dimuat");
    return res.status(mapped.status).json({ success: false, message: mapped.message });
  }
};

const getReturnableGoodsReceipts = async (req, res) => {
  try {
    const search = normalizeText(req.query.search, 120);
    const result = await pool.query(
      `SELECT gr.id,gr.receipt_number,gr.received_date,po.po_number,
              s.supplier_code,s.supplier_name,
              COALESCE(SUM(gri.quantity_received-gri.quantity_damaged),0)
                -COALESCE(SUM(returned.reserved_quantity),0) AS remaining_quantity
       FROM app.goods_receipts gr
       JOIN app.purchase_orders po ON po.id=gr.purchase_order_id
       JOIN app.suppliers s ON s.id=po.supplier_id
       JOIN app.goods_receipt_items gri ON gri.goods_receipt_id=gr.id
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(pri.quantity),0) AS reserved_quantity
         FROM app.purchase_return_items pri
         JOIN app.purchase_returns pr ON pr.id=pri.purchase_return_id
         WHERE pri.product_id=gri.product_id AND pr.goods_receipt_id=gr.id
           AND pr.status IN ('DRAFT','PENDING','APPROVED')
       ) returned ON TRUE
       WHERE ($1='' OR gr.receipt_number ILIKE $2 OR po.po_number ILIKE $2 OR s.supplier_name ILIKE $2)
       GROUP BY gr.id,po.po_number,s.supplier_code,s.supplier_name
       HAVING COALESCE(SUM(gri.quantity_received-gri.quantity_damaged),0)
              -COALESCE(SUM(returned.reserved_quantity),0) > 0
       ORDER BY gr.received_date DESC,gr.created_at DESC LIMIT 50`,
      [search, `%${search}%`],
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error fetching returnable receipts:", error);
    return res.status(500).json({ success: false, message: "Daftar penerimaan yang dapat diretur gagal dimuat" });
  }
};

const getReturnableGoodsReceiptItems = async (req, res) => {
  try {
    const receipt = await pool.query(
      `SELECT gr.id,gr.receipt_number,gr.received_date,po.po_number,
              s.supplier_code,s.supplier_name
       FROM app.goods_receipts gr
       JOIN app.purchase_orders po ON po.id=gr.purchase_order_id
       JOIN app.suppliers s ON s.id=po.supplier_id WHERE gr.id=$1`,
      [req.params.id],
    );
    if (!receipt.rows.length) return res.status(404).json({ success: false, message: "Penerimaan barang tidak ditemukan" });
    const items = await pool.query(
      `SELECT gri.product_id,p.sku,p.product_name,p.unit,poi.unit_price,
              gri.quantity_received-gri.quantity_damaged AS received_good_quantity,
              COALESCE(returned.reserved_quantity,0) AS returned_quantity,
              gri.quantity_received-gri.quantity_damaged-COALESCE(returned.reserved_quantity,0) AS returnable_quantity
       FROM app.goods_receipt_items gri
       JOIN app.products p ON p.id=gri.product_id
       JOIN app.purchase_order_items poi ON poi.id=gri.purchase_order_item_id
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(pri.quantity),0) AS reserved_quantity
         FROM app.purchase_return_items pri
         JOIN app.purchase_returns pr ON pr.id=pri.purchase_return_id
         WHERE pri.product_id=gri.product_id AND pr.goods_receipt_id=gri.goods_receipt_id
           AND pr.status IN ('DRAFT','PENDING','APPROVED')
       ) returned ON TRUE
       WHERE gri.goods_receipt_id=$1
         AND gri.quantity_received-gri.quantity_damaged-COALESCE(returned.reserved_quantity,0)>0
       ORDER BY p.product_name`,
      [req.params.id],
    );
    return res.json({ success: true, data: { ...receipt.rows[0], items: items.rows } });
  } catch (error) {
    const mapped = mapDatabaseError(error, "Rincian barang yang dapat diretur gagal dimuat");
    return res.status(mapped.status).json({ success: false, message: mapped.message });
  }
};

const createPurchaseReturn = async (req, res) => {
  const client = await pool.connect();
  try {
    const returnDate = parseReturnDate(req.body.return_date);
    if (returnDate === undefined) return res.status(400).json({ success: false, message: "Tanggal retur tidak valid" });
    const goodsReceiptId = normalizeText(req.body.goods_receipt_id, 50);
    const reason = normalizeText(req.body.reason, 50).toUpperCase();
    if (!goodsReceiptId) return res.status(400).json({ success: false, message: "Penerimaan barang harus dipilih" });
    if (!REASONS.has(reason)) return res.status(400).json({ success: false, message: "Alasan retur tidak valid" });
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length || items.length > 100) return res.status(400).json({ success: false, message: "Retur harus memiliki 1 sampai 100 produk" });

    const normalizedItems = [];
    const uniqueProducts = new Set();
    for (const item of items) {
      const productId = normalizeText(item.product_id, 50);
      const quantity = parseQuantity(item.quantity);
      const condition = normalizeText(item.item_condition, 30).toUpperCase();
      if (!productId || quantity === null || !CONDITIONS.has(condition)) {
        return res.status(400).json({ success: false, message: "Produk, jumlah, dan kondisi retur harus diisi dengan benar" });
      }
      if (uniqueProducts.has(productId)) return res.status(400).json({ success: false, message: "Produk tidak boleh dicatat lebih dari sekali" });
      uniqueProducts.add(productId);
      normalizedItems.push({ productId, quantity, condition, notes: normalizeText(item.notes, 300) || null });
    }

    await client.query("BEGIN");
    const receipt = await client.query(`SELECT id FROM app.goods_receipts WHERE id=$1 FOR SHARE`, [goodsReceiptId]);
    if (!receipt.rows.length) throw makeError("Penerimaan barang tidak ditemukan", 404);
    const available = await client.query(
      `SELECT gri.product_id,poi.unit_price,
              gri.quantity_received-gri.quantity_damaged-COALESCE(returned.reserved_quantity,0) AS returnable_quantity
       FROM app.goods_receipt_items gri
       JOIN app.purchase_order_items poi ON poi.id=gri.purchase_order_item_id
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(pri.quantity),0) AS reserved_quantity
         FROM app.purchase_return_items pri
         JOIN app.purchase_returns pr ON pr.id=pri.purchase_return_id
         WHERE pri.product_id=gri.product_id AND pr.goods_receipt_id=gri.goods_receipt_id
           AND pr.status IN ('DRAFT','PENDING','APPROVED')
       ) returned ON TRUE
       WHERE gri.goods_receipt_id=$1 AND gri.product_id=ANY($2::uuid[])`,
      [goodsReceiptId, [...uniqueProducts]],
    );
    const availableMap = new Map(available.rows.map((row) => [row.product_id, row]));
    for (const item of normalizedItems) {
      const source = availableMap.get(item.productId);
      if (!source) throw makeError("Salah satu produk tidak berasal dari penerimaan yang dipilih", 400);
      if (item.quantity > Number(source.returnable_quantity)) {
        throw makeError(`Jumlah retur melebihi sisa yang dapat dikembalikan (${Number(source.returnable_quantity)})`, 409);
      }
      item.unitPrice = source.unit_price;
    }
    const returnNumber = await resolveCodeNumber({ client, moduleKey: "PURCHASE_RETURN", manualCode: req.body.return_number });
    const header = await client.query(
      `INSERT INTO app.purchase_returns(return_number,goods_receipt_id,return_date,reason,notes,created_by)
       VALUES($1,$2,COALESCE($3::date,CURRENT_DATE),$4,$5,$6) RETURNING *`,
      [returnNumber, goodsReceiptId, returnDate, reason, normalizeText(req.body.notes, 1000) || null, req.user.id],
    );
    for (const item of normalizedItems) {
      await client.query(
        `INSERT INTO app.purchase_return_items(purchase_return_id,product_id,quantity,unit_price,item_condition,notes)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [header.rows[0].id, item.productId, item.quantity, item.unitPrice, item.condition, item.notes],
      );
    }
    await client.query("COMMIT");
    const detail = await getPurchaseReturnDetail(pool, header.rows[0].id);
    return res.status(201).json({ success: true, message: "Retur pembelian berhasil disimpan sebagai draft", data: detail });
  } catch (error) {
    await client.query("ROLLBACK");
    const mapped = mapDatabaseError(error, "Retur pembelian gagal disimpan");
    return res.status(mapped.status).json({ success: false, message: mapped.message });
  } finally {
    client.release();
  }
};

const submitPurchaseReturn = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(`SELECT * FROM app.purchase_returns WHERE id=$1 FOR UPDATE`, [req.params.id]);
    if (!current.rows.length) throw makeError("Retur pembelian tidak ditemukan", 404);
    if (!['DRAFT', 'REJECTED'].includes(current.rows[0].status)) throw makeError("Hanya retur draft atau ditolak yang dapat diajukan", 409);
    const action = current.rows[0].status === 'REJECTED' ? 'RESUBMITTED' : 'SUBMITTED';
    const result = await client.query(
      `UPDATE app.purchase_returns SET status='PENDING',submitted_by=$1,submitted_at=NOW(),decided_by=NULL,decided_at=NULL,rejection_reason=NULL WHERE id=$2 RETURNING *`,
      [req.user.id, req.params.id],
    );
    await client.query(`INSERT INTO app.transaction_approvals(transaction_type,transaction_id,action,acted_by) VALUES('PURCHASE_RETURN',$1,$2,$3)`, [req.params.id, action, req.user.id]);
    await client.query("COMMIT");
    return res.json({ success: true, message: "Retur pembelian berhasil diajukan", data: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    const mapped = mapDatabaseError(error, "Retur pembelian gagal diajukan");
    return res.status(mapped.status).json({ success: false, message: mapped.message });
  } finally { client.release(); }
};

const decidePurchaseReturn = async (req, res) => {
  const client = await pool.connect();
  try {
    const decision = normalizeText(req.body.decision, 20).toUpperCase();
    const reason = normalizeText(req.body.reason, 500);
    if (!['APPROVED', 'REJECTED'].includes(decision)) return res.status(400).json({ success: false, message: "Keputusan harus APPROVED atau REJECTED" });
    if (decision === 'REJECTED' && reason.length < 5) return res.status(400).json({ success: false, message: "Alasan penolakan minimal 5 karakter" });

    await client.query("BEGIN");
    const current = await client.query(`SELECT * FROM app.purchase_returns WHERE id=$1 FOR UPDATE`, [req.params.id]);
    if (!current.rows.length) throw makeError("Retur pembelian tidak ditemukan", 404);
    if (current.rows[0].status !== 'PENDING') throw makeError("Retur pembelian sudah tidak menunggu persetujuan", 409);
    if (current.rows[0].submitted_by === req.user.id) throw makeError("Pengaju tidak dapat memutuskan retur pembeliannya sendiri", 403);

    if (decision === 'APPROVED') {
      const items = await client.query(
        `SELECT pri.*,p.product_name,p.current_stock,
                gri.quantity_received-gri.quantity_damaged AS received_good_quantity,
                COALESCE(previous.returned_quantity,0) AS previously_returned
         FROM app.purchase_return_items pri
         JOIN app.purchase_returns pr ON pr.id=pri.purchase_return_id
         JOIN app.products p ON p.id=pri.product_id
         JOIN app.goods_receipt_items gri ON gri.goods_receipt_id=pr.goods_receipt_id AND gri.product_id=pri.product_id
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(other_item.quantity),0) AS returned_quantity
           FROM app.purchase_return_items other_item
           JOIN app.purchase_returns other_return ON other_return.id=other_item.purchase_return_id
           WHERE other_return.goods_receipt_id=pr.goods_receipt_id
             AND other_item.product_id=pri.product_id
             AND other_return.status='APPROVED' AND other_return.id<>pr.id
         ) previous ON TRUE
         WHERE pri.purchase_return_id=$1 ORDER BY pri.id FOR UPDATE OF p`,
        [req.params.id],
      );
      for (const item of items.rows) {
        if (Number(item.quantity) + Number(item.previously_returned) > Number(item.received_good_quantity)) {
          throw makeError(`Jumlah retur ${item.product_name} melebihi barang yang pernah diterima`, 409);
        }
        if (Number(item.current_stock) < Number(item.quantity)) {
          throw makeError(`Stok ${item.product_name} tidak mencukupi untuk retur`, 409);
        }
      }
      for (const item of items.rows) {
        await client.query(
          `INSERT INTO app.inventory_movements(product_id,movement_type,quantity,reference_type,reference_id,notes,created_by)
           VALUES($1,'RETURN_OUT',$2,'PURCHASE_RETURN',$3,$4,$5)`,
          [item.product_id, item.quantity, req.params.id, `Retur pembelian ${current.rows[0].return_number}`, req.user.id],
        );
        await client.query(`UPDATE app.products SET current_stock=current_stock-$1,updated_at=NOW() WHERE id=$2`, [item.quantity, item.product_id]);
      }
    }

    const result = await client.query(
      `UPDATE app.purchase_returns SET status=$1,decided_by=$2,decided_at=NOW(),rejection_reason=$3 WHERE id=$4 RETURNING *`,
      [decision, req.user.id, decision === 'REJECTED' ? reason : null, req.params.id],
    );
    await client.query(
      `INSERT INTO app.transaction_approvals(transaction_type,transaction_id,action,reason,acted_by) VALUES('PURCHASE_RETURN',$1,$2,$3,$4)`,
      [req.params.id, decision, decision === 'REJECTED' ? reason : null, req.user.id],
    );
    await client.query("COMMIT");
    return res.json({ success: true, message: decision === 'APPROVED' ? "Retur pembelian disetujui dan stok telah dikurangi" : "Retur pembelian ditolak", data: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    const mapped = mapDatabaseError(error, "Keputusan retur pembelian gagal disimpan");
    return res.status(mapped.status).json({ success: false, message: mapped.message });
  } finally { client.release(); }
};

const cancelPurchaseReturn = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE app.purchase_returns SET status='CANCELLED'
       WHERE id=$1 AND status IN ('DRAFT','REJECTED') RETURNING *`,
      [req.params.id],
    );
    if (!result.rows.length) {
      const exists = await pool.query(`SELECT status FROM app.purchase_returns WHERE id=$1`, [req.params.id]);
      if (!exists.rows.length) return res.status(404).json({ success: false, message: "Retur pembelian tidak ditemukan" });
      return res.status(409).json({ success: false, message: "Retur yang sedang diproses atau sudah disetujui tidak dapat dibatalkan" });
    }
    return res.json({ success: true, message: "Retur pembelian dibatalkan", data: result.rows[0] });
  } catch (error) {
    const mapped = mapDatabaseError(error, "Retur pembelian gagal dibatalkan");
    return res.status(mapped.status).json({ success: false, message: mapped.message });
  }
};

const getSettlementInvoices = async (req, res) => {
  try {
    const source = await pool.query(
      `SELECT po.id AS purchase_order_id,po.supplier_id
       FROM app.purchase_returns pr
       JOIN app.goods_receipts gr ON gr.id=pr.goods_receipt_id
       JOIN app.purchase_orders po ON po.id=gr.purchase_order_id
       WHERE pr.id=$1`,
      [req.params.id],
    );
    if (!source.rows.length) return res.status(404).json({ success: false, message: "Retur pembelian tidak ditemukan" });
    const result = await pool.query(
      `SELECT si.id,si.invoice_number,si.purchase_order_id,si.invoice_date,si.due_date,
              po.po_number,
              CASE WHEN si.purchase_order_id=$2 THEN 'SAME_PO' ELSE 'SAME_SUPPLIER' END AS scope,
              si.total_amount,
              COALESCE(payments.paid_amount,0) AS paid_amount,
              COALESCE(credits.credit_amount,0) AS credit_amount,
              GREATEST(si.total_amount-COALESCE(payments.paid_amount,0)-COALESCE(credits.credit_amount,0),0) AS outstanding_amount
       FROM app.supplier_invoices si
       JOIN app.purchase_orders po ON po.id=si.purchase_order_id
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(sp.amount),0) AS paid_amount
         FROM app.supplier_payments sp WHERE sp.supplier_invoice_id=si.id
       ) payments ON TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(prs.amount),0) AS credit_amount
         FROM app.purchase_return_settlements prs
         WHERE prs.supplier_invoice_id=si.id
           AND prs.settlement_type IN ('INVOICE_DEDUCTION','SUPPLIER_CREDIT')
       ) credits ON TRUE
       WHERE po.supplier_id=$1
         AND si.total_amount-COALESCE(payments.paid_amount,0)-COALESCE(credits.credit_amount,0)>0
       ORDER BY CASE WHEN si.purchase_order_id=$2 THEN 0 ELSE 1 END,si.invoice_date DESC`,
      [source.rows[0].supplier_id, source.rows[0].purchase_order_id],
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    const mapped = mapDatabaseError(error, "Daftar tagihan untuk penyelesaian retur gagal dimuat");
    return res.status(mapped.status).json({ success: false, message: mapped.message });
  }
};

const createPurchaseReturnSettlement = async (req, res) => {
  const client = await pool.connect();
  try {
    const settlementType = normalizeText(req.body.settlement_type, 30).toUpperCase();
    const settlementDate = parseReturnDate(req.body.settlement_date);
    const amount = Number(req.body.amount);
    const invoiceId = normalizeText(req.body.supplier_invoice_id, 50) || null;
    if (!SETTLEMENT_TYPES.has(settlementType)) return res.status(400).json({ success: false, message: "Metode penyelesaian retur tidak valid" });
    if (settlementDate === undefined) return res.status(400).json({ success: false, message: "Tanggal penyelesaian tidak valid" });
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8) {
      return res.status(400).json({ success: false, message: "Nilai penyelesaian harus lebih dari nol dan maksimal dua angka desimal" });
    }
    const needsInvoice = ["INVOICE_DEDUCTION", "SUPPLIER_CREDIT"].includes(settlementType);
    if (needsInvoice !== Boolean(invoiceId)) {
      return res.status(400).json({ success: false, message: needsInvoice ? "Tagihan tujuan harus dipilih" : "Metode ini tidak menggunakan tagihan tujuan" });
    }

    await client.query("BEGIN");
    const purchaseReturn = await client.query(
      `SELECT pr.id,pr.return_number,pr.status,po.id AS purchase_order_id,po.supplier_id
       FROM app.purchase_returns pr
       JOIN app.goods_receipts gr ON gr.id=pr.goods_receipt_id
       JOIN app.purchase_orders po ON po.id=gr.purchase_order_id
       WHERE pr.id=$1 FOR UPDATE OF pr`,
      [req.params.id],
    );
    if (!purchaseReturn.rows.length) throw makeError("Retur pembelian tidak ditemukan", 404);
    const source = purchaseReturn.rows[0];
    if (source.status !== "APPROVED") throw makeError("Penyelesaian hanya dapat dicatat untuk retur yang sudah disetujui", 409);
    const totals = await client.query(
      `SELECT COALESCE((SELECT SUM(pri.quantity*pri.unit_price) FROM app.purchase_return_items pri WHERE pri.purchase_return_id=$1),0) AS total_amount,
              COALESCE((SELECT SUM(prs.amount) FROM app.purchase_return_settlements prs WHERE prs.purchase_return_id=$1),0) AS settled_amount`,
      [req.params.id],
    );
    const remaining = Number(totals.rows[0].total_amount) - Number(totals.rows[0].settled_amount);
    if (amount > remaining) throw makeError(`Nilai penyelesaian melebihi sisa retur (${remaining})`, 409);

    if (needsInvoice) {
      const invoice = await client.query(
        `SELECT si.id,si.purchase_order_id,po.supplier_id,
                GREATEST(si.total_amount-COALESCE(payments.paid_amount,0)-COALESCE(credits.credit_amount,0),0) AS outstanding_amount
         FROM app.supplier_invoices si
         JOIN app.purchase_orders po ON po.id=si.purchase_order_id
         LEFT JOIN LATERAL (SELECT SUM(sp.amount) AS paid_amount FROM app.supplier_payments sp WHERE sp.supplier_invoice_id=si.id) payments ON TRUE
         LEFT JOIN LATERAL (
           SELECT SUM(prs.amount) AS credit_amount FROM app.purchase_return_settlements prs
           WHERE prs.supplier_invoice_id=si.id AND prs.settlement_type IN ('INVOICE_DEDUCTION','SUPPLIER_CREDIT')
         ) credits ON TRUE
         WHERE si.id=$1 FOR UPDATE OF si`,
        [invoiceId],
      );
      if (!invoice.rows.length) throw makeError("Tagihan supplier tidak ditemukan", 404);
      const target = invoice.rows[0];
      if (target.supplier_id !== source.supplier_id) throw makeError("Tagihan tujuan harus berasal dari supplier yang sama", 400);
      if (settlementType === "INVOICE_DEDUCTION" && target.purchase_order_id !== source.purchase_order_id) {
        throw makeError("Potongan tagihan hanya dapat diterapkan pada PO asal retur", 400);
      }
      if (settlementType === "SUPPLIER_CREDIT" && target.purchase_order_id === source.purchase_order_id) {
        throw makeError("Kredit supplier harus diterapkan pada tagihan lain; gunakan potong tagihan asal untuk PO ini", 400);
      }
      if (amount > Number(target.outstanding_amount)) throw makeError(`Nilai kredit melebihi sisa tagihan (${Number(target.outstanding_amount)})`, 409);
    } else if (settlementType === "REFUND") {
      const refundable = await client.query(
        `SELECT COALESCE((SELECT SUM(sp.amount) FROM app.supplier_payments sp WHERE sp.purchase_order_id=$1),0)
                -COALESCE((
                  SELECT SUM(prs.amount) FROM app.purchase_return_settlements prs
                  JOIN app.purchase_returns other_return ON other_return.id=prs.purchase_return_id
                  JOIN app.goods_receipts other_receipt ON other_receipt.id=other_return.goods_receipt_id
                  WHERE other_receipt.purchase_order_id=$1 AND prs.settlement_type='REFUND'
                ),0) AS refundable_amount`,
        [source.purchase_order_id],
      );
      if (amount > Number(refundable.rows[0].refundable_amount)) {
        throw makeError(`Refund melebihi pembayaran supplier yang dapat dikembalikan (${Number(refundable.rows[0].refundable_amount)})`, 409);
      }
    }

    const result = await client.query(
      `INSERT INTO app.purchase_return_settlements(
         purchase_return_id,supplier_invoice_id,settlement_type,settlement_date,
         amount,reference_number,notes,created_by
       ) VALUES($1,$2,$3,COALESCE($4::date,CURRENT_DATE),$5,$6,$7,$8) RETURNING *`,
      [req.params.id, invoiceId, settlementType, settlementDate, amount,
        normalizeText(req.body.reference_number, 100) || null,
        normalizeText(req.body.notes, 1000) || null, req.user.id],
    );
    await client.query("COMMIT");
    return res.status(201).json({ success: true, message: "Penyelesaian retur supplier berhasil dicatat", data: { ...result.rows[0], return_number: source.return_number } });
  } catch (error) {
    await client.query("ROLLBACK");
    const mapped = mapDatabaseError(error, "Penyelesaian retur supplier gagal disimpan");
    return res.status(mapped.status).json({ success: false, message: mapped.message });
  } finally { client.release(); }
};

module.exports = {
  cancelPurchaseReturn,
  createPurchaseReturn,
  createPurchaseReturnSettlement,
  decidePurchaseReturn,
  getAllPurchaseReturns,
  getPurchaseReturnById,
  getSettlementInvoices,
  getReturnableGoodsReceiptItems,
  getReturnableGoodsReceipts,
  submitPurchaseReturn,
};
