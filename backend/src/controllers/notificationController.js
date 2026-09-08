const pool = require("../config/database");

const daysUntil = (value) => {
  const target = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
};

const dueDescription = (date, owner) => {
  const remaining = daysUntil(date);
  if (remaining < 0) return `${owner} terlambat ${Math.abs(remaining)} hari.`;
  if (remaining === 0) return `${owner} jatuh tempo hari ini.`;
  return `${owner} jatuh tempo dalam ${remaining} hari.`;
};

const getNotifications = async (req, res) => {
  try {
    const role = req.user.role;
    const notifications = [];
    const jobs = [];

    if (["ADMIN", "PURCHASING", "WAREHOUSE", "MANAGER"].includes(role)) {
      jobs.push(pool.query(`
        SELECT id,sku,product_name,current_stock,minimum_stock,unit,updated_at
        FROM app.products
        WHERE status='ACTIVE' AND current_stock<=minimum_stock
        ORDER BY current_stock-minimum_stock ASC,product_name LIMIT 20
      `).then(({ rows }) => rows.forEach((row) => notifications.push({
        key: `LOW_STOCK:${row.id}:${Number(row.current_stock)}`,
        type: "LOW_STOCK",
        severity: Number(row.current_stock) === 0 ? "DANGER" : "WARNING",
        title: Number(row.current_stock) === 0 ? "Stok habis" : "Stok menipis",
        description: `${row.product_name} tersisa ${Number(row.current_stock)} ${row.unit}; minimum ${Number(row.minimum_stock)}.`,
        path: "/products",
        occurred_at: row.updated_at,
      }))));
    }

    if (["ADMIN", "PURCHASING", "WAREHOUSE", "FINANCE", "MANAGER"].includes(role)) {
      jobs.push(pool.query(`
        SELECT po.id,po.po_number,po.status,po.order_date,po.updated_at,s.supplier_name
        FROM app.purchase_orders po JOIN app.suppliers s ON s.id=po.supplier_id
        WHERE po.status IN ('SUBMITTED','PARTIALLY_RECEIVED')
        ORDER BY po.updated_at DESC LIMIT 20
      `).then(({ rows }) => rows.forEach((row) => notifications.push({
        key: `PO_PENDING:${row.id}:${row.status}`,
        type: "PURCHASE_ORDER",
        severity: row.status === "PARTIALLY_RECEIVED" ? "WARNING" : "INFO",
        title: row.status === "PARTIALLY_RECEIVED" ? "Penerimaan PO belum lengkap" : "PO menunggu penerimaan",
        description: `${row.po_number} · ${row.supplier_name}`,
        path: "/purchase-orders",
        occurred_at: row.updated_at,
      }))));
    }

    if (["ADMIN", "FINANCE", "SALES", "MANAGER"].includes(role)) {
      jobs.push(pool.query(`
        SELECT i.id,i.invoice_number,i.due_date,i.grand_total-i.paid_amount outstanding,i.updated_at,c.customer_name
        FROM app.invoices i JOIN app.customers c ON c.id=i.customer_id
        WHERE i.grand_total>i.paid_amount AND i.due_date<=CURRENT_DATE+7
        ORDER BY i.due_date LIMIT 20
      `).then(({ rows }) => rows.forEach((row) => notifications.push({
        key: `CUSTOMER_INVOICE_DUE:${row.id}:${String(row.due_date).slice(0,10)}`,
        type: "CUSTOMER_INVOICE",
        severity: daysUntil(row.due_date) < 0 ? "DANGER" : "WARNING",
        title: daysUntil(row.due_date) < 0 ? "Invoice pelanggan terlambat" : "Invoice pelanggan segera jatuh tempo",
        description: `${row.invoice_number} · ${dueDescription(row.due_date, row.customer_name)}`,
        path: "/invoices",
        occurred_at: row.updated_at,
      }))));
    }

    if (["ADMIN", "PURCHASING", "FINANCE", "MANAGER"].includes(role)) {
      jobs.push(pool.query(`
        SELECT si.id,si.invoice_number,si.due_date,si.updated_at,s.supplier_name
        FROM app.supplier_invoices si
        JOIN app.purchase_orders po ON po.id=si.purchase_order_id
        JOIN app.suppliers s ON s.id=po.supplier_id
        LEFT JOIN LATERAL (SELECT COALESCE(SUM(amount),0) paid FROM app.supplier_payments sp WHERE sp.supplier_invoice_id=si.id) p ON TRUE
        WHERE si.total_amount>p.paid AND si.due_date<=CURRENT_DATE+7
        ORDER BY si.due_date LIMIT 20
      `).then(({ rows }) => rows.forEach((row) => notifications.push({
        key: `SUPPLIER_INVOICE_DUE:${row.id}:${String(row.due_date).slice(0,10)}`,
        type: "SUPPLIER_INVOICE",
        severity: daysUntil(row.due_date) < 0 ? "DANGER" : "WARNING",
        title: daysUntil(row.due_date) < 0 ? "Tagihan supplier terlambat" : "Tagihan supplier segera jatuh tempo",
        description: `${row.invoice_number} · ${dueDescription(row.due_date, row.supplier_name)}`,
        path: "/supplier-invoices",
        occurred_at: row.updated_at,
      }))));
    }

    if (["ADMIN", "PURCHASING", "WAREHOUSE", "MANAGER"].includes(role)) {
      jobs.push(pool.query(`
        SELECT gr.id,gr.receipt_number,gr.received_date,gr.created_at,po.po_number
        FROM app.goods_receipts gr JOIN app.purchase_orders po ON po.id=gr.purchase_order_id
        WHERE gr.created_at>=NOW()-INTERVAL '3 days'
        ORDER BY gr.created_at DESC LIMIT 10
      `).then(({ rows }) => rows.forEach((row) => notifications.push({
        key: `GOODS_RECEIPT:${row.id}`,
        type: "GOODS_RECEIPT",
        severity: "SUCCESS",
        title: "Penerimaan barang tercatat",
        description: `${row.receipt_number} untuk ${row.po_number}.`,
        path: "/goods-receipts",
        occurred_at: row.created_at,
      }))));
    }

    if (role === "ADMIN") {
      jobs.push(pool.query(`
        SELECT id,full_name,role,created_at FROM app.users
        WHERE created_at>=NOW()-INTERVAL '3 days' AND id<>$1
        ORDER BY created_at DESC LIMIT 10
      `, [req.user.id]).then(({ rows }) => rows.forEach((row) => notifications.push({
        key: `USER_CREATED:${row.id}`,
        type: "USER",
        severity: "INFO",
        title: "Pengguna baru ditambahkan",
        description: `${row.full_name} · ${row.role}`,
        path: "/users",
        occurred_at: row.created_at,
      }))));
    }

    await Promise.all(jobs);
    notifications.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
    const limited = notifications.slice(0, 50);
    const keys = limited.map((item) => item.key);
    const readResult = keys.length
      ? await pool.query(`SELECT notification_key FROM app.notification_reads WHERE user_id=$1 AND notification_key=ANY($2::varchar[])`, [req.user.id, keys])
      : { rows: [] };
    const readKeys = new Set(readResult.rows.map((row) => row.notification_key));
    const data = limited.map((item) => ({ ...item, is_read: readKeys.has(item.key) }));
    return res.json({ success: true, data, unread_count: data.filter((item) => !item.is_read).length });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ success: false, message: "Notifikasi gagal dimuat" });
  }
};

const markNotificationsRead = async (req, res) => {
  const keys = Array.isArray(req.body.keys) ? [...new Set(req.body.keys.filter((key) => typeof key === "string" && key.length <= 180))].slice(0, 100) : [];
  if (!keys.length) return res.status(400).json({ success: false, message: "Notifikasi yang akan ditandai belum dipilih" });
  await pool.query(`INSERT INTO app.notification_reads(user_id,notification_key) SELECT $1,key FROM UNNEST($2::varchar[]) key ON CONFLICT(user_id,notification_key) DO UPDATE SET read_at=NOW()`, [req.user.id, keys]);
  return res.json({ success: true, message: "Notifikasi berhasil ditandai dibaca" });
};

module.exports = { getNotifications, markNotificationsRead };
