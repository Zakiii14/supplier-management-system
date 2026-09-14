const path = require("node:path");
const { randomBytes } = require("node:crypto");

require("dotenv").config({ path: path.resolve(__dirname, "../.env.test"), override: true });
if (process.env.DB_NAME !== "supplier_management_test") {
  throw new Error("Integration tests must use supplier_management_test");
}

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const pool = require("../src/config/database");
const app = require("../src/app");

const suffix = randomBytes(4).toString("hex").toUpperCase();
const password = `Return-${randomBytes(12).toString("hex")}`;
const data = {
  warehouse: `return_wh_${suffix.toLowerCase()}`,
  manager: `return_mgr_${suffix.toLowerCase()}`,
  finance: `return_fin_${suffix.toLowerCase()}`,
  supplier: `RT-SUP-${suffix}`,
  category: `RT-CAT-${suffix}`,
  sku: `RT-SKU-${suffix}`,
  po: `RT-PO-${suffix}`,
  receipt: `RT-GR-${suffix}`,
};

let warehouseAuth;
let managerAuth;
let financeAuth;
let productId;
let purchaseOrderId;
let goodsReceiptId;
let purchaseReturnId;
let supplierInvoiceId;

before(async () => {
  const hash = await bcrypt.hash(password, 8);
  await pool.query(
    `INSERT INTO app.users(username,full_name,email,password_hash,role,status)
     VALUES($1,'Return Warehouse',$2,$3,'WAREHOUSE','ACTIVE'),
           ($4,'Return Manager',$5,$3,'MANAGER','ACTIVE'),
           ($6,'Return Finance',$7,$3,'FINANCE','ACTIVE')`,
    [data.warehouse, `${data.warehouse}@local.test`, hash, data.manager, `${data.manager}@local.test`, data.finance, `${data.finance}@local.test`],
  );
  for (const username of [data.warehouse, data.manager, data.finance]) {
    const login = await request(app).post("/api/auth/login").send({ identifier: username, password });
    assert.equal(login.status, 200);
    if (username === data.warehouse) warehouseAuth = `Bearer ${login.body.data.access_token}`;
    else if (username === data.manager) managerAuth = `Bearer ${login.body.data.access_token}`;
    else financeAuth = `Bearer ${login.body.data.access_token}`;
  }

  const supplier = await pool.query(
    `INSERT INTO app.suppliers(supplier_code,supplier_name,status)
     VALUES($1,'Return Supplier','ACTIVE') RETURNING id`,
    [data.supplier],
  );
  const category = await pool.query(
    `INSERT INTO app.categories(category_code,category_name,status)
     VALUES($1,'Return Category','ACTIVE') RETURNING id`,
    [data.category],
  );
  const product = await pool.query(
    `INSERT INTO app.products(sku,product_name,category_id,supplier_id,unit,purchase_price,current_stock,status)
     VALUES($1,'Return Product',$2,$3,'PCS',12500,10,'ACTIVE') RETURNING id`,
    [data.sku, category.rows[0].id, supplier.rows[0].id],
  );
  productId = product.rows[0].id;

  const purchaseOrder = await pool.query(
    `INSERT INTO app.purchase_orders(po_number,supplier_id,status,approval_status)
     VALUES($1,$2,'RECEIVED','APPROVED') RETURNING id`,
    [data.po, supplier.rows[0].id],
  );
  purchaseOrderId = purchaseOrder.rows[0].id;
  const purchaseOrderItem = await pool.query(
    `INSERT INTO app.purchase_order_items(purchase_order_id,product_id,quantity,unit_price,received_quantity)
     VALUES($1,$2,10,12500,10) RETURNING id`,
    [purchaseOrderId, productId],
  );
  const goodsReceipt = await pool.query(
    `INSERT INTO app.goods_receipts(receipt_number,purchase_order_id)
     VALUES($1,$2) RETURNING id`,
    [data.receipt, purchaseOrderId],
  );
  goodsReceiptId = goodsReceipt.rows[0].id;
  await pool.query(
    `INSERT INTO app.goods_receipt_items(goods_receipt_id,purchase_order_item_id,product_id,quantity_received,quantity_damaged)
     VALUES($1,$2,$3,10,0)`,
    [goodsReceiptId, purchaseOrderItem.rows[0].id, productId],
  );
  const supplierInvoice = await pool.query(
    `INSERT INTO app.supplier_invoices(invoice_number,purchase_order_id,invoice_date,due_date,total_amount)
     VALUES($1,$2,CURRENT_DATE,CURRENT_DATE+30,125000) RETURNING id`,
    [`RT-INV-${suffix}`, purchaseOrderId],
  );
  supplierInvoiceId = supplierInvoice.rows[0].id;
});

after(async () => {
  try {
    if (purchaseReturnId) {
      await pool.query(`DELETE FROM app.purchase_return_settlements WHERE purchase_return_id=$1`, [purchaseReturnId]);
      await pool.query(
        `DELETE FROM app.inventory_movements WHERE reference_type='PURCHASE_RETURN' AND reference_id=$1`,
        [purchaseReturnId],
      );
      await pool.query(
        `DELETE FROM app.transaction_approvals WHERE transaction_type='PURCHASE_RETURN' AND transaction_id=$1`,
        [purchaseReturnId],
      );
      await pool.query(`DELETE FROM app.purchase_returns WHERE id=$1`, [purchaseReturnId]);
    }
    await pool.query(`DELETE FROM app.supplier_invoices WHERE id=$1`, [supplierInvoiceId]);
    await pool.query(`DELETE FROM app.goods_receipt_items WHERE goods_receipt_id=$1`, [goodsReceiptId]);
    await pool.query(`DELETE FROM app.goods_receipts WHERE id=$1`, [goodsReceiptId]);
    await pool.query(`DELETE FROM app.purchase_order_items WHERE purchase_order_id=$1`, [purchaseOrderId]);
    await pool.query(`DELETE FROM app.purchase_orders WHERE id=$1`, [purchaseOrderId]);
    await pool.query(`DELETE FROM app.products WHERE sku=$1`, [data.sku]);
    await pool.query(`DELETE FROM app.categories WHERE category_code=$1`, [data.category]);
    await pool.query(`DELETE FROM app.suppliers WHERE supplier_code=$1`, [data.supplier]);
    await pool.query(`DELETE FROM app.users WHERE username=ANY($1::varchar[])`, [[data.warehouse, data.manager, data.finance]]);
  } finally {
    await pool.end();
  }
});

test("purchase return reserves receipt quantities, enforces approval duties, and reduces stock", async () => {
  let response = await request(app)
    .get(`/api/purchase-returns/goods-receipts/${goodsReceiptId}/items`)
    .set("Authorization", warehouseAuth);
  assert.equal(response.status, 200);
  assert.equal(Number(response.body.data.items[0].returnable_quantity), 10);

  response = await request(app)
    .post("/api/purchase-returns")
    .set("Authorization", warehouseAuth)
    .send({
      goods_receipt_id: goodsReceiptId,
      return_date: new Date().toISOString().slice(0, 10),
      reason: "DAMAGED",
      notes: "Kemasan rusak saat pemeriksaan",
      items: [{ product_id: productId, quantity: 3, item_condition: "DAMAGED", notes: "Segel terbuka" }],
    });
  assert.equal(response.status, 201);
  assert.match(response.body.data.return_number, /^PRT-/);
  assert.equal(response.body.data.status, "DRAFT");
  purchaseReturnId = response.body.data.id;

  response = await request(app)
    .post(`/api/purchase-returns/${purchaseReturnId}/submit`)
    .set("Authorization", warehouseAuth)
    .send();
  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, "PENDING");

  response = await request(app)
    .post(`/api/purchase-returns/${purchaseReturnId}/decision`)
    .set("Authorization", warehouseAuth)
    .send({ decision: "APPROVED" });
  assert.equal(response.status, 403);

  response = await request(app)
    .post(`/api/purchase-returns/${purchaseReturnId}/decision`)
    .set("Authorization", managerAuth)
    .send({ decision: "APPROVED" });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, "APPROVED");

  const product = await pool.query(`SELECT current_stock FROM app.products WHERE id=$1`, [productId]);
  assert.equal(Number(product.rows[0].current_stock), 7);
  const movement = await pool.query(
    `SELECT movement_type,quantity FROM app.inventory_movements
     WHERE reference_type='PURCHASE_RETURN' AND reference_id=$1`,
    [purchaseReturnId],
  );
  assert.equal(movement.rows.length, 1);
  assert.equal(movement.rows[0].movement_type, "RETURN_OUT");
  assert.equal(Number(movement.rows[0].quantity), 3);

  response = await request(app)
    .get(`/api/purchase-returns/${purchaseReturnId}`)
    .set("Authorization", warehouseAuth);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.approval_history.map((entry) => entry.action), ["APPROVED", "SUBMITTED"]);

  response = await request(app)
    .get(`/api/purchase-returns/goods-receipts/${goodsReceiptId}/items`)
    .set("Authorization", warehouseAuth);
  assert.equal(response.status, 200);
  assert.equal(Number(response.body.data.items[0].returnable_quantity), 7);
});

test("approved purchase return can be settled and reduces supplier invoice outstanding", async () => {
  let response = await request(app)
    .get(`/api/purchase-returns/${purchaseReturnId}/settlement-invoices`)
    .set("Authorization", financeAuth);
  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].id, supplierInvoiceId);
  assert.equal(Number(response.body.data[0].outstanding_amount), 125000);

  response = await request(app)
    .post(`/api/purchase-returns/${purchaseReturnId}/settlements`)
    .set("Authorization", warehouseAuth)
    .send({ settlement_type: "INVOICE_DEDUCTION", supplier_invoice_id: supplierInvoiceId, amount: 20000 });
  assert.equal(response.status, 403);

  response = await request(app)
    .post(`/api/purchase-returns/${purchaseReturnId}/settlements`)
    .set("Authorization", financeAuth)
    .send({ settlement_type: "INVOICE_DEDUCTION", supplier_invoice_id: supplierInvoiceId, amount: 20000, reference_number: "MEMO-RETURN" });
  assert.equal(response.status, 201);

  response = await request(app)
    .get(`/api/purchase-returns/${purchaseReturnId}`)
    .set("Authorization", financeAuth);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.settlement_status, "PARTIAL");
  assert.equal(Number(response.body.data.settled_amount), 20000);
  assert.equal(Number(response.body.data.settlement_remaining), 17500);

  response = await request(app)
    .get(`/api/supplier-invoices/${supplierInvoiceId}`)
    .set("Authorization", financeAuth);
  assert.equal(response.status, 200);
  assert.equal(Number(response.body.data.return_credit_amount), 20000);
  assert.equal(Number(response.body.data.adjusted_total_amount), 105000);
  assert.equal(Number(response.body.data.outstanding_amount), 105000);

  response = await request(app)
    .post(`/api/purchase-returns/${purchaseReturnId}/settlements`)
    .set("Authorization", financeAuth)
    .send({ settlement_type: "REFUND", amount: 17500, reference_number: "REFUND-TRANSFER" });
  assert.equal(response.status, 409);

  response = await request(app)
    .post(`/api/purchase-returns/${purchaseReturnId}/settlements`)
    .set("Authorization", financeAuth)
    .send({ settlement_type: "REPLACEMENT", amount: 17500, reference_number: "REPLACEMENT-GR" });
  assert.equal(response.status, 201);

  response = await request(app)
    .get(`/api/purchase-returns/${purchaseReturnId}`)
    .set("Authorization", financeAuth);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.settlement_status, "SETTLED");
  assert.equal(Number(response.body.data.settlement_remaining), 0);

  response = await request(app)
    .post(`/api/purchase-returns/${purchaseReturnId}/settlements`)
    .set("Authorization", financeAuth)
    .send({ settlement_type: "REFUND", amount: 1 });
  assert.equal(response.status, 409);
});

test("purchase return validates filters, identifiers, and returnable quantity", async () => {
  let response = await request(app)
    .get("/api/purchase-returns")
    .query({ status: "UNKNOWN" })
    .set("Authorization", managerAuth);
  assert.equal(response.status, 400);

  response = await request(app)
    .get("/api/purchase-returns/not-a-uuid")
    .set("Authorization", managerAuth);
  assert.equal(response.status, 400);

  response = await request(app)
    .post("/api/purchase-returns")
    .set("Authorization", warehouseAuth)
    .send({
      goods_receipt_id: goodsReceiptId,
      reason: "OTHER",
      items: [{ product_id: productId, quantity: 8, item_condition: "OTHER" }],
    });
  assert.equal(response.status, 409);
});
