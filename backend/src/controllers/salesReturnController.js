const pool = require("../config/database");
const { resolveCodeNumber } = require("../services/codeNumberService");
const { parseDateRange } = require("../utils/dateRange");

const STATUSES = new Set(["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"]);
const REASONS = new Set(["DAMAGED", "WRONG_ITEM", "QUALITY_ISSUE", "CUSTOMER_REQUEST", "OTHER"]);
const CONDITIONS = new Set(["SALEABLE", "DAMAGED", "QUARANTINE"]);
const SETTLEMENT_TYPES = new Set(["INVOICE_DEDUCTION", "REFUND", "REPLACEMENT", "CUSTOMER_CREDIT"]);

const text = (value, max = 1000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const errorWithStatus = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const quantity = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && Math.abs(parsed * 1000 - Math.round(parsed * 1000)) < 1e-8 ? parsed : null;
};
const date = (value) => {
  const normalized = text(value, 10);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized ? normalized : undefined;
};
const mapError = (error, fallback) => {
  if (error.statusCode) return { status: error.statusCode, message: error.message };
  if (error.code === "22P02") return { status: 400, message: "ID atau nilai data tidak valid" };
  if (error.code === "23505") return { status: 409, message: "Nomor retur atau produk sudah digunakan" };
  if (error.code === "23503") return { status: 400, message: "Referensi delivery, invoice, atau produk tidak valid" };
  return { status: 500, message: fallback };
};

const getDetail = async (queryable, id) => {
  const header = await queryable.query(
    `SELECT sr.*,d.delivery_number,d.delivery_date,so.id AS sales_order_id,so.so_number,
            c.id AS customer_id,c.customer_code,c.customer_name,
            creator.full_name AS created_by_name,submitter.full_name AS submitted_by_name,
            decider.full_name AS decided_by_name,COUNT(sri.id)::INTEGER AS item_count,
            COALESCE(SUM(sri.quantity),0) AS total_quantity,
            COALESCE(SUM(sri.quantity*sri.unit_price),0) AS total_amount,
            COALESCE((SELECT SUM(srs.amount) FROM app.sales_return_settlements srs WHERE srs.sales_return_id=sr.id),0) AS settled_amount,
            GREATEST(COALESCE(SUM(sri.quantity*sri.unit_price),0)-COALESCE((SELECT SUM(srs.amount) FROM app.sales_return_settlements srs WHERE srs.sales_return_id=sr.id),0),0) AS settlement_remaining
     FROM app.sales_returns sr
     JOIN app.deliveries d ON d.id=sr.delivery_id
     JOIN app.sales_orders so ON so.id=d.sales_order_id
     JOIN app.customers c ON c.id=so.customer_id
     LEFT JOIN app.users creator ON creator.id=sr.created_by
     LEFT JOIN app.users submitter ON submitter.id=sr.submitted_by
     LEFT JOIN app.users decider ON decider.id=sr.decided_by
     LEFT JOIN app.sales_return_items sri ON sri.sales_return_id=sr.id
     WHERE sr.id=$1
     GROUP BY sr.id,d.delivery_number,d.delivery_date,so.id,so.so_number,c.id,c.customer_code,c.customer_name,
              creator.full_name,submitter.full_name,decider.full_name`,
    [id],
  );
  if (!header.rows.length) return null;
  const [items, history, settlements] = await Promise.all([
    queryable.query(
      `SELECT sri.id,sri.product_id,p.sku,p.product_name,p.unit,sri.quantity,sri.unit_price,
              sri.quantity*sri.unit_price AS subtotal,sri.item_condition,sri.notes
       FROM app.sales_return_items sri JOIN app.products p ON p.id=sri.product_id
       WHERE sri.sales_return_id=$1 ORDER BY p.product_name`, [id]),
    queryable.query(
      `SELECT ta.id,ta.action,ta.reason,ta.acted_at,u.full_name AS acted_by_name,u.role AS acted_by_role
       FROM app.transaction_approvals ta LEFT JOIN app.users u ON u.id=ta.acted_by
       WHERE ta.transaction_type='SALES_RETURN' AND ta.transaction_id=$1 ORDER BY ta.acted_at DESC`, [id]),
    queryable.query(
      `SELECT srs.*,i.invoice_number,u.full_name AS created_by_name
       FROM app.sales_return_settlements srs LEFT JOIN app.invoices i ON i.id=srs.invoice_id
       LEFT JOIN app.users u ON u.id=srs.created_by
       WHERE srs.sales_return_id=$1 ORDER BY srs.settlement_date DESC,srs.created_at DESC`, [id]),
  ]);
  const result = header.rows[0];
  const total = Number(result.total_amount);
  const settled = Number(result.settled_amount);
  return { ...result, settlement_status: settled <= 0 ? "UNSETTLED" : settled >= total ? "SETTLED" : "PARTIAL", items: items.rows, approval_history: history.rows, settlements: settlements.rows };
};

const getAllSalesReturns = async (req, res) => {
  try {
    const { search = "", status = "", date_from = "", date_to = "", page = 1, limit = 10 } = req.query;
    const currentPage = Number(page); const pageSize = Number(limit);
    if (!Number.isInteger(currentPage) || currentPage < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) return res.status(400).json({ success: false, message: "Parameter pagination tidak valid" });
    const normalizedStatus = text(status, 20).toUpperCase();
    if (normalizedStatus && !STATUSES.has(normalizedStatus)) return res.status(400).json({ success: false, message: "Status retur penjualan tidak valid" });
    const range = parseDateRange(date_from, date_to);
    if (range.error) return res.status(400).json({ success: false, message: range.error });
    const values = []; const filters = []; const searchText = text(search, 120);
    if (searchText) { values.push(`%${searchText}%`); filters.push(`(sr.return_number ILIKE $${values.length} OR d.delivery_number ILIKE $${values.length} OR so.so_number ILIKE $${values.length} OR c.customer_name ILIKE $${values.length})`); }
    if (normalizedStatus) { values.push(normalizedStatus); filters.push(`sr.status=$${values.length}`); }
    if (range.dateFrom) { values.push(range.dateFrom); filters.push(`sr.return_date >= $${values.length}::date`); }
    if (range.dateTo) { values.push(range.dateTo); filters.push(`sr.return_date <= $${values.length}::date`); }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const from = `FROM app.sales_returns sr JOIN app.deliveries d ON d.id=sr.delivery_id JOIN app.sales_orders so ON so.id=d.sales_order_id JOIN app.customers c ON c.id=so.customer_id LEFT JOIN app.users u ON u.id=sr.created_by`;
    const count = await pool.query(`SELECT COUNT(*)::INTEGER total ${from} ${where}`, values);
    const listValues = [...values, pageSize, (currentPage - 1) * pageSize];
    const result = await pool.query(
      `SELECT sr.id,sr.return_number,sr.return_date,sr.status,sr.reason,sr.notes,sr.created_at,
              d.delivery_number,so.so_number,c.customer_code,c.customer_name,u.full_name AS created_by_name,
              COUNT(sri.id)::INTEGER item_count,COALESCE(SUM(sri.quantity),0) total_quantity,
              COALESCE(SUM(sri.quantity*sri.unit_price),0) total_amount,
              COALESCE((SELECT SUM(srs.amount) FROM app.sales_return_settlements srs WHERE srs.sales_return_id=sr.id),0) settled_amount
       ${from} LEFT JOIN app.sales_return_items sri ON sri.sales_return_id=sr.id ${where}
       GROUP BY sr.id,d.delivery_number,so.so_number,c.customer_code,c.customer_name,u.full_name
       ORDER BY sr.return_date DESC,sr.created_at DESC LIMIT $${listValues.length-1} OFFSET $${listValues.length}`, listValues);
    const total = count.rows[0].total;
    return res.json({ success: true, data: result.rows, pagination: { page: currentPage, limit: pageSize, total, total_pages: Math.ceil(total / pageSize) } });
  } catch (error) { console.error(error); return res.status(500).json({ success: false, message: "Retur penjualan gagal dimuat" }); }
};

const getSalesReturnById = async (req, res) => {
  try { const detail = await getDetail(pool, req.params.id); return detail ? res.json({ success: true, data: detail }) : res.status(404).json({ success: false, message: "Retur penjualan tidak ditemukan" }); }
  catch (error) { const mapped = mapError(error, "Detail retur penjualan gagal dimuat"); return res.status(mapped.status).json({ success: false, message: mapped.message }); }
};

const getReturnableDeliveries = async (req, res) => {
  try {
    const search = text(req.query.search, 120);
    const result = await pool.query(
      `SELECT d.id,d.delivery_number,d.delivery_date,so.so_number,c.customer_code,c.customer_name,
              COALESCE(SUM(di.quantity_delivered),0)-COALESCE(SUM(returned.reserved_quantity),0) remaining_quantity
       FROM app.deliveries d JOIN app.sales_orders so ON so.id=d.sales_order_id JOIN app.customers c ON c.id=so.customer_id
       JOIN app.delivery_items di ON di.delivery_id=d.id
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(sri.quantity),0) reserved_quantity FROM app.sales_return_items sri
         JOIN app.sales_returns sr ON sr.id=sri.sales_return_id
         WHERE sri.product_id=di.product_id AND sr.delivery_id=d.id AND sr.status IN ('DRAFT','PENDING','APPROVED')
       ) returned ON TRUE
       WHERE d.status='DELIVERED' AND ($1='' OR d.delivery_number ILIKE $2 OR so.so_number ILIKE $2 OR c.customer_name ILIKE $2)
       GROUP BY d.id,so.so_number,c.customer_code,c.customer_name
       HAVING COALESCE(SUM(di.quantity_delivered),0)-COALESCE(SUM(returned.reserved_quantity),0)>0
       ORDER BY d.delivery_date DESC,d.created_at DESC LIMIT 50`, [search, `%${search}%`]);
    return res.json({ success: true, data: result.rows });
  } catch (error) { console.error(error); return res.status(500).json({ success: false, message: "Daftar delivery yang dapat diretur gagal dimuat" }); }
};

const getReturnableDeliveryItems = async (req, res) => {
  try {
    const header = await pool.query(
      `SELECT d.id,d.delivery_number,d.delivery_date,so.id sales_order_id,so.so_number,c.customer_code,c.customer_name
       FROM app.deliveries d JOIN app.sales_orders so ON so.id=d.sales_order_id JOIN app.customers c ON c.id=so.customer_id
       WHERE d.id=$1 AND d.status='DELIVERED'`, [req.params.id]);
    if (!header.rows.length) return res.status(404).json({ success: false, message: "Delivery terkirim tidak ditemukan" });
    const items = await pool.query(
      `SELECT di.product_id,p.sku,p.product_name,p.unit,soi.unit_price,di.quantity_delivered,
              COALESCE(returned.reserved_quantity,0) returned_quantity,
              di.quantity_delivered-COALESCE(returned.reserved_quantity,0) returnable_quantity
       FROM app.delivery_items di JOIN app.products p ON p.id=di.product_id
       JOIN app.sales_order_items soi ON soi.id=di.sales_order_item_id
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(sri.quantity),0) reserved_quantity FROM app.sales_return_items sri
         JOIN app.sales_returns sr ON sr.id=sri.sales_return_id
         WHERE sri.product_id=di.product_id AND sr.delivery_id=di.delivery_id AND sr.status IN ('DRAFT','PENDING','APPROVED')
       ) returned ON TRUE
       WHERE di.delivery_id=$1 AND di.quantity_delivered-COALESCE(returned.reserved_quantity,0)>0 ORDER BY p.product_name`, [req.params.id]);
    return res.json({ success: true, data: { ...header.rows[0], items: items.rows } });
  } catch (error) { const mapped = mapError(error, "Rincian barang delivery gagal dimuat"); return res.status(mapped.status).json({ success: false, message: mapped.message }); }
};

const createSalesReturn = async (req, res) => {
  const client = await pool.connect();
  try {
    const returnDate = date(req.body.return_date); const deliveryId = text(req.body.delivery_id, 50); const reason = text(req.body.reason, 50).toUpperCase();
    if (returnDate === undefined) return res.status(400).json({ success: false, message: "Tanggal retur tidak valid" });
    if (!deliveryId || !REASONS.has(reason)) return res.status(400).json({ success: false, message: "Delivery dan alasan retur harus dipilih" });
    const inputItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (!inputItems.length || inputItems.length > 100) return res.status(400).json({ success: false, message: "Retur harus memiliki 1 sampai 100 produk" });
    const items = []; const productIds = new Set();
    for (const input of inputItems) {
      const productId = text(input.product_id, 50); const itemQuantity = quantity(input.quantity); const condition = text(input.item_condition, 20).toUpperCase();
      if (!productId || itemQuantity === null || !CONDITIONS.has(condition)) return res.status(400).json({ success: false, message: "Produk, jumlah, dan kondisi harus diisi dengan benar" });
      if (productIds.has(productId)) return res.status(400).json({ success: false, message: "Produk tidak boleh dicatat dua kali" });
      productIds.add(productId); items.push({ productId, quantity: itemQuantity, condition, notes: text(input.notes, 300) || null });
    }
    await client.query("BEGIN");
    const delivery = await client.query(`SELECT id FROM app.deliveries WHERE id=$1 AND status='DELIVERED' FOR SHARE`, [deliveryId]);
    if (!delivery.rows.length) throw errorWithStatus("Delivery terkirim tidak ditemukan", 404);
    const available = await client.query(
      `SELECT di.product_id,soi.unit_price,di.quantity_delivered-COALESCE(returned.reserved_quantity,0) returnable_quantity
       FROM app.delivery_items di JOIN app.sales_order_items soi ON soi.id=di.sales_order_item_id
       LEFT JOIN LATERAL (SELECT COALESCE(SUM(sri.quantity),0) reserved_quantity FROM app.sales_return_items sri JOIN app.sales_returns sr ON sr.id=sri.sales_return_id WHERE sri.product_id=di.product_id AND sr.delivery_id=di.delivery_id AND sr.status IN ('DRAFT','PENDING','APPROVED')) returned ON TRUE
       WHERE di.delivery_id=$1 AND di.product_id=ANY($2::uuid[])`, [deliveryId, [...productIds]]);
    const map = new Map(available.rows.map((row) => [row.product_id, row]));
    for (const item of items) { const source = map.get(item.productId); if (!source) throw errorWithStatus("Produk bukan bagian dari delivery", 400); if (item.quantity > Number(source.returnable_quantity)) throw errorWithStatus(`Jumlah retur melebihi sisa yang dapat diretur (${Number(source.returnable_quantity)})`, 409); item.unitPrice = source.unit_price; }
    const returnNumber = await resolveCodeNumber({ client, moduleKey: "SALES_RETURN", manualCode: req.body.return_number });
    const created = await client.query(
      `INSERT INTO app.sales_returns(return_number,delivery_id,return_date,reason,notes,created_by)
       VALUES($1,$2,COALESCE($3::date,CURRENT_DATE),$4,$5,$6) RETURNING *`, [returnNumber, deliveryId, returnDate, reason, text(req.body.notes) || null, req.user.id]);
    for (const item of items) await client.query(`INSERT INTO app.sales_return_items(sales_return_id,product_id,quantity,unit_price,item_condition,notes) VALUES($1,$2,$3,$4,$5,$6)`, [created.rows[0].id,item.productId,item.quantity,item.unitPrice,item.condition,item.notes]);
    await client.query("COMMIT");
    return res.status(201).json({ success: true, message: "Retur penjualan disimpan sebagai draft", data: await getDetail(pool, created.rows[0].id) });
  } catch (error) { await client.query("ROLLBACK"); const mapped = mapError(error, "Retur penjualan gagal disimpan"); return res.status(mapped.status).json({ success: false, message: mapped.message }); }
  finally { client.release(); }
};

const submitSalesReturn = async (req, res) => {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const current = await client.query(`SELECT * FROM app.sales_returns WHERE id=$1 FOR UPDATE`, [req.params.id]); if (!current.rows.length) throw errorWithStatus("Retur penjualan tidak ditemukan",404); if (!["DRAFT","REJECTED"].includes(current.rows[0].status)) throw errorWithStatus("Hanya retur draft atau ditolak yang dapat diajukan",409); const action=current.rows[0].status==="REJECTED"?"RESUBMITTED":"SUBMITTED"; const result=await client.query(`UPDATE app.sales_returns SET status='PENDING',submitted_by=$1,submitted_at=NOW(),decided_by=NULL,decided_at=NULL,rejection_reason=NULL WHERE id=$2 RETURNING *`,[req.user.id,req.params.id]); await client.query(`INSERT INTO app.transaction_approvals(transaction_type,transaction_id,action,acted_by) VALUES('SALES_RETURN',$1,$2,$3)`,[req.params.id,action,req.user.id]); await client.query("COMMIT"); return res.json({success:true,message:"Retur penjualan berhasil diajukan",data:result.rows[0]}); }
  catch(error){await client.query("ROLLBACK");const mapped=mapError(error,"Retur penjualan gagal diajukan");return res.status(mapped.status).json({success:false,message:mapped.message});} finally{client.release();}
};

const decideSalesReturn = async (req, res) => {
  const client = await pool.connect();
  try {
    const decision=text(req.body.decision,20).toUpperCase();const reason=text(req.body.reason,500);
    if(!["APPROVED","REJECTED"].includes(decision))return res.status(400).json({success:false,message:"Keputusan harus APPROVED atau REJECTED"});
    if(decision==="REJECTED"&&reason.length<5)return res.status(400).json({success:false,message:"Alasan penolakan minimal 5 karakter"});
    await client.query("BEGIN");const current=await client.query(`SELECT * FROM app.sales_returns WHERE id=$1 FOR UPDATE`,[req.params.id]);
    if(!current.rows.length)throw errorWithStatus("Retur penjualan tidak ditemukan",404);if(current.rows[0].status!=="PENDING")throw errorWithStatus("Retur tidak sedang menunggu persetujuan",409);if(current.rows[0].submitted_by===req.user.id)throw errorWithStatus("Pengaju tidak dapat memutuskan retur sendiri",403);
    if(decision==="APPROVED"){
      const items=await client.query(`SELECT sri.*,p.product_name,di.quantity_delivered,COALESCE(previous.quantity,0) previous_quantity FROM app.sales_return_items sri JOIN app.sales_returns sr ON sr.id=sri.sales_return_id JOIN app.products p ON p.id=sri.product_id JOIN app.delivery_items di ON di.delivery_id=sr.delivery_id AND di.product_id=sri.product_id LEFT JOIN LATERAL(SELECT COALESCE(SUM(other.quantity),0) quantity FROM app.sales_return_items other JOIN app.sales_returns prior ON prior.id=other.sales_return_id WHERE prior.delivery_id=sr.delivery_id AND other.product_id=sri.product_id AND prior.status='APPROVED' AND prior.id<>sr.id) previous ON TRUE WHERE sri.sales_return_id=$1 FOR UPDATE OF p`,[req.params.id]);
      for(const item of items.rows)if(Number(item.quantity)+Number(item.previous_quantity)>Number(item.quantity_delivered))throw errorWithStatus(`Jumlah retur ${item.product_name} melebihi jumlah terkirim`,409);
      for(const item of items.rows)if(item.item_condition==="SALEABLE"){await client.query(`INSERT INTO app.inventory_movements(product_id,movement_type,quantity,reference_type,reference_id,notes,created_by) VALUES($1,'RETURN_IN',$2,'SALES_RETURN',$3,$4,$5)`,[item.product_id,item.quantity,req.params.id,`Retur penjualan ${current.rows[0].return_number}`,req.user.id]);await client.query(`UPDATE app.products SET current_stock=current_stock+$1,updated_at=NOW() WHERE id=$2`,[item.quantity,item.product_id]);}
    }
    const result=await client.query(`UPDATE app.sales_returns SET status=$1,decided_by=$2,decided_at=NOW(),rejection_reason=$3 WHERE id=$4 RETURNING *`,[decision,req.user.id,decision==="REJECTED"?reason:null,req.params.id]);await client.query(`INSERT INTO app.transaction_approvals(transaction_type,transaction_id,action,reason,acted_by) VALUES('SALES_RETURN',$1,$2,$3,$4)`,[req.params.id,decision,decision==="REJECTED"?reason:null,req.user.id]);await client.query("COMMIT");return res.json({success:true,message:decision==="APPROVED"?"Retur disetujui; barang layak jual telah masuk stok":"Retur penjualan ditolak",data:result.rows[0]});
  }catch(error){await client.query("ROLLBACK");const mapped=mapError(error,"Keputusan retur gagal disimpan");return res.status(mapped.status).json({success:false,message:mapped.message});}finally{client.release();}
};

const cancelSalesReturn = async (req,res)=>{try{const result=await pool.query(`UPDATE app.sales_returns SET status='CANCELLED' WHERE id=$1 AND status IN ('DRAFT','REJECTED') RETURNING *`,[req.params.id]);if(result.rows.length)return res.json({success:true,message:"Retur penjualan dibatalkan",data:result.rows[0]});const exists=await pool.query(`SELECT id FROM app.sales_returns WHERE id=$1`,[req.params.id]);return res.status(exists.rows.length?409:404).json({success:false,message:exists.rows.length?"Retur yang diproses atau disetujui tidak dapat dibatalkan":"Retur penjualan tidak ditemukan"});}catch(error){const mapped=mapError(error,"Retur gagal dibatalkan");return res.status(mapped.status).json({success:false,message:mapped.message});}};

const getSettlementInvoices = async (req,res)=>{try{const source=await pool.query(`SELECT so.id sales_order_id,so.customer_id FROM app.sales_returns sr JOIN app.deliveries d ON d.id=sr.delivery_id JOIN app.sales_orders so ON so.id=d.sales_order_id WHERE sr.id=$1`,[req.params.id]);if(!source.rows.length)return res.status(404).json({success:false,message:"Retur penjualan tidak ditemukan"});const result=await pool.query(`SELECT i.id,i.invoice_number,i.sales_order_id,i.invoice_date,i.due_date,so.so_number,CASE WHEN i.sales_order_id=$2 THEN 'SAME_SO' ELSE 'SAME_CUSTOMER' END scope,i.grand_total,i.paid_amount,i.credit_amount,GREATEST(i.grand_total-i.paid_amount-i.credit_amount,0) outstanding_amount FROM app.invoices i JOIN app.sales_orders so ON so.id=i.sales_order_id WHERE i.customer_id=$1 AND i.status<>'CANCELLED' AND i.grand_total-i.paid_amount-i.credit_amount>0 ORDER BY CASE WHEN i.sales_order_id=$2 THEN 0 ELSE 1 END,i.invoice_date DESC`,[source.rows[0].customer_id,source.rows[0].sales_order_id]);return res.json({success:true,data:result.rows});}catch(error){const mapped=mapError(error,"Daftar invoice penyelesaian gagal dimuat");return res.status(mapped.status).json({success:false,message:mapped.message});}};

const createSalesReturnSettlement = async (req,res)=>{
  const client=await pool.connect();
  try{const type=text(req.body.settlement_type,30).toUpperCase();const settlementDate=date(req.body.settlement_date);const amount=Number(req.body.amount);const invoiceId=text(req.body.invoice_id,50)||null;if(!SETTLEMENT_TYPES.has(type))return res.status(400).json({success:false,message:"Metode penyelesaian tidak valid"});if(settlementDate===undefined||!Number.isFinite(amount)||amount<=0||Math.abs(amount*100-Math.round(amount*100))>1e-8)return res.status(400).json({success:false,message:"Tanggal dan nilai penyelesaian tidak valid; nilai maksimal dua angka desimal"});const needsInvoice=["INVOICE_DEDUCTION","CUSTOMER_CREDIT"].includes(type);if(needsInvoice!==Boolean(invoiceId))return res.status(400).json({success:false,message:needsInvoice?"Invoice tujuan harus dipilih":"Metode ini tidak menggunakan invoice tujuan"});
    await client.query("BEGIN");const sourceResult=await client.query(`SELECT sr.id,sr.return_number,sr.status,so.id sales_order_id,so.customer_id FROM app.sales_returns sr JOIN app.deliveries d ON d.id=sr.delivery_id JOIN app.sales_orders so ON so.id=d.sales_order_id WHERE sr.id=$1 FOR UPDATE OF sr`,[req.params.id]);if(!sourceResult.rows.length)throw errorWithStatus("Retur penjualan tidak ditemukan",404);const source=sourceResult.rows[0];if(source.status!=="APPROVED")throw errorWithStatus("Penyelesaian hanya untuk retur yang disetujui",409);const totals=await client.query(`SELECT COALESCE((SELECT SUM(quantity*unit_price) FROM app.sales_return_items WHERE sales_return_id=$1),0) total,COALESCE((SELECT SUM(amount) FROM app.sales_return_settlements WHERE sales_return_id=$1),0) settled`,[req.params.id]);const remaining=Number(totals.rows[0].total)-Number(totals.rows[0].settled);if(amount>remaining)throw errorWithStatus(`Nilai penyelesaian melebihi sisa retur (${remaining})`,409);
    if(needsInvoice){const targetResult=await client.query(`SELECT * FROM app.invoices WHERE id=$1 FOR UPDATE`,[invoiceId]);if(!targetResult.rows.length)throw errorWithStatus("Invoice tidak ditemukan",404);const target=targetResult.rows[0];if(target.customer_id!==source.customer_id)throw errorWithStatus("Invoice harus milik customer yang sama",400);if(type==="INVOICE_DEDUCTION"&&target.sales_order_id!==source.sales_order_id)throw errorWithStatus("Potongan invoice hanya untuk sales order asal",400);if(type==="CUSTOMER_CREDIT"&&target.sales_order_id===source.sales_order_id)throw errorWithStatus("Kredit customer digunakan pada invoice lain",400);const outstanding=Number(target.grand_total)-Number(target.paid_amount)-Number(target.credit_amount);if(amount>outstanding)throw errorWithStatus(`Nilai kredit melebihi sisa invoice (${outstanding})`,409);await client.query(`UPDATE app.invoices SET credit_amount=credit_amount+$1,status=CASE WHEN paid_amount+credit_amount+$1>=grand_total THEN 'PAID'::app.invoice_status WHEN paid_amount+credit_amount+$1>0 THEN 'PARTIAL'::app.invoice_status ELSE 'UNPAID'::app.invoice_status END,updated_at=NOW() WHERE id=$2`,[amount,invoiceId]);}
    else if(type==="REFUND"){const refundable=await client.query(`SELECT COALESCE((SELECT SUM(p.amount) FROM app.payments p JOIN app.invoices i ON i.id=p.invoice_id WHERE i.sales_order_id=$1),0)-COALESCE((SELECT SUM(srs.amount) FROM app.sales_return_settlements srs JOIN app.sales_returns other ON other.id=srs.sales_return_id JOIN app.deliveries d ON d.id=other.delivery_id WHERE d.sales_order_id=$1 AND srs.settlement_type='REFUND'),0) amount`,[source.sales_order_id]);if(amount>Number(refundable.rows[0].amount))throw errorWithStatus(`Refund melebihi pembayaran yang dapat dikembalikan (${Number(refundable.rows[0].amount)})`,409);}
    const result=await client.query(`INSERT INTO app.sales_return_settlements(sales_return_id,invoice_id,settlement_type,settlement_date,amount,reference_number,notes,created_by) VALUES($1,$2,$3,COALESCE($4::date,CURRENT_DATE),$5,$6,$7,$8) RETURNING *`,[req.params.id,invoiceId,type,settlementDate,amount,text(req.body.reference_number,100)||null,text(req.body.notes)||null,req.user.id]);await client.query("COMMIT");return res.status(201).json({success:true,message:"Penyelesaian retur customer berhasil dicatat",data:{...result.rows[0],return_number:source.return_number}});
  }catch(error){await client.query("ROLLBACK");const mapped=mapError(error,"Penyelesaian retur gagal disimpan");return res.status(mapped.status).json({success:false,message:mapped.message});}finally{client.release();}
};

module.exports={getAllSalesReturns,getSalesReturnById,getReturnableDeliveries,getReturnableDeliveryItems,createSalesReturn,submitSalesReturn,decideSalesReturn,cancelSalesReturn,getSettlementInvoices,createSalesReturnSettlement};
