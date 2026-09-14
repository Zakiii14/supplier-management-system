const path = require("node:path");
const { randomBytes } = require("node:crypto");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env.test"),
  override: true,
});

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
const password = `FinanceSync-${randomBytes(12).toString("hex")}`;
const today = new Date().toISOString().slice(0, 10);
const ids = {};
let authorization;

before(async () => {
  const passwordHash = await bcrypt.hash(password, 8);
  ids.user = (
    await pool.query(
      `INSERT INTO app.users(username,full_name,email,password_hash,role,status)
       VALUES($1,'Finance Sync Admin',$2,$3,'ADMIN','ACTIVE') RETURNING id`,
      [`finance_sync_${suffix.toLowerCase()}`, `finance.sync.${suffix.toLowerCase()}@local.test`, passwordHash],
    )
  ).rows[0].id;

  const login = await request(app).post("/api/auth/login").send({
    identifier: `finance_sync_${suffix.toLowerCase()}`,
    password,
  });
  assert.equal(login.status, 200);
  authorization = `Bearer ${login.body.data.access_token}`;

  ids.supplier = (
    await pool.query(
      `INSERT INTO app.suppliers(supplier_code,supplier_name,status)
       VALUES($1,'Finance Sync Supplier','ACTIVE') RETURNING id`,
      [`FS-SUP-${suffix}`],
    )
  ).rows[0].id;
  ids.category = (
    await pool.query(
      `INSERT INTO app.categories(category_code,category_name,status)
       VALUES($1,'Finance Sync Category','ACTIVE') RETURNING id`,
      [`FS-CAT-${suffix}`],
    )
  ).rows[0].id;
  ids.product = (
    await pool.query(
      `INSERT INTO app.products(sku,product_name,category_id,supplier_id,unit,purchase_price,status)
       VALUES($1,'Finance Sync Product',$2,$3,'PCS',10000,'ACTIVE') RETURNING id`,
      [`FS-SKU-${suffix}`, ids.category, ids.supplier],
    )
  ).rows[0].id;
  ids.purchaseOrder = (
    await pool.query(
      `INSERT INTO app.purchase_orders(po_number,supplier_id,order_date,status,approval_status,created_by)
       VALUES($1,$2,$3,'SUBMITTED','APPROVED',$4) RETURNING id`,
      [`FS-PO-${suffix}`, ids.supplier, today, ids.user],
    )
  ).rows[0].id;
  await pool.query(
    `INSERT INTO app.purchase_order_items(purchase_order_id,product_id,quantity,unit_price)
     VALUES($1,$2,10,10000)`,
    [ids.purchaseOrder, ids.product],
  );
});

after(async () => {
  try {
    await pool.query(`DELETE FROM app.supplier_payments WHERE purchase_order_id=$1`, [ids.purchaseOrder]);
    await pool.query(`DELETE FROM app.supplier_invoices WHERE purchase_order_id=$1`, [ids.purchaseOrder]);
    await pool.query(`DELETE FROM app.purchase_order_items WHERE purchase_order_id=$1`, [ids.purchaseOrder]);
    await pool.query(`DELETE FROM app.purchase_orders WHERE id=$1`, [ids.purchaseOrder]);
    await pool.query(`DELETE FROM app.products WHERE id=$1`, [ids.product]);
    await pool.query(`DELETE FROM app.categories WHERE id=$1`, [ids.category]);
    await pool.query(`DELETE FROM app.suppliers WHERE id=$1`, [ids.supplier]);
    await pool.query(`DELETE FROM app.users WHERE id=$1`, [ids.user]);
  } finally {
    await pool.end();
  }
});

test("supplier invoice and PO payment stay synchronized and duplicate PO invoice is rejected", async () => {
  let response = await request(app)
    .post(`/api/purchase-orders/${ids.purchaseOrder}/supplier-payments`)
    .set("Authorization", authorization)
    .send({
      payment_number: `FS-SPAY-EARLY-${suffix}`,
      payment_date: today,
      amount: 10000,
      method: "CASH",
    });
  assert.equal(response.status, 409);

  response = await request(app)
    .post("/api/supplier-invoices")
    .set("Authorization", authorization)
    .send({
      invoice_number: `FS-INV-${suffix}`,
      purchase_order_id: ids.purchaseOrder,
      invoice_date: today,
      due_date: today,
      total_amount: 100000,
    });
  assert.equal(response.status, 201);
  ids.supplierInvoice = response.body.data.id;

  response = await request(app)
    .post("/api/supplier-invoices")
    .set("Authorization", authorization)
    .send({
      invoice_number: `FS-INV-DUP-${suffix}`,
      purchase_order_id: ids.purchaseOrder,
      invoice_date: today,
      due_date: today,
      total_amount: 100000,
    });
  assert.equal(response.status, 409);

  response = await request(app)
    .post(`/api/purchase-orders/${ids.purchaseOrder}/supplier-payments`)
    .set("Authorization", authorization)
    .send({
      payment_number: `FS-SPAY-${suffix}`,
      payment_date: today,
      amount: 40000,
      method: "CASH",
    });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.supplier_invoice_id, ids.supplierInvoice);
  assert.equal(response.body.data.supplier_invoice_number, `FS-INV-${suffix}`);

  response = await request(app)
    .get(`/api/supplier-invoices/${ids.supplierInvoice}`)
    .set("Authorization", authorization);
  assert.equal(response.status, 200);
  assert.equal(Number(response.body.data.paid_amount), 40000);
  assert.equal(Number(response.body.data.outstanding_amount), 60000);

  response = await request(app)
    .get(`/api/purchase-orders/${ids.purchaseOrder}`)
    .set("Authorization", authorization);
  assert.equal(response.status, 200);
  assert.equal(Number(response.body.data.paid_amount), 40000);
  assert.equal(Number(response.body.data.outstanding_amount), 60000);
  assert.equal(response.body.data.supplier_payments[0].supplier_invoice_id, ids.supplierInvoice);
});
