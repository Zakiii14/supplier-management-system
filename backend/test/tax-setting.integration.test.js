const path = require("node:path");
const { randomBytes } = require("node:crypto");

require("dotenv").config({ path: path.resolve(__dirname, "../.env.test"), override: true });
if (process.env.DB_NAME !== "supplier_management_test") throw new Error("Integration tests must use supplier_management_test");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const pool = require("../src/config/database");
const app = require("../src/app");

const suffix = randomBytes(4).toString("hex").toUpperCase();
const password = `Tax-${randomBytes(8).toString("hex")}`;
const ids = {};
let adminAuth; let financeAuth; let previousSettings;

before(async () => {
  previousSettings = (await pool.query(`SELECT * FROM app.tax_settings WHERE id=1`)).rows[0];
  const hash = await bcrypt.hash(password, 8);
  ids.usernames = [`tax_admin_${suffix.toLowerCase()}`, `tax_finance_${suffix.toLowerCase()}`];
  await pool.query(
    `INSERT INTO app.users(username,full_name,email,password_hash,role,status)
     VALUES($1,'Tax Admin',$2,$3,'ADMIN','ACTIVE'),($4,'Tax Finance',$5,$3,'FINANCE','ACTIVE')`,
    [ids.usernames[0],`${ids.usernames[0]}@local.test`,hash,ids.usernames[1],`${ids.usernames[1]}@local.test`],
  );
  for (const username of ids.usernames) {
    const login = await request(app).post("/api/auth/login").send({ identifier: username, password });
    assert.equal(login.status, 200);
    if (username === ids.usernames[0]) adminAuth = `Bearer ${login.body.data.access_token}`;
    else financeAuth = `Bearer ${login.body.data.access_token}`;
  }
  const supplier = await pool.query(`INSERT INTO app.suppliers(supplier_code,supplier_name,status) VALUES($1,'Tax Supplier','ACTIVE') RETURNING id`, [`SUP-TAX-${suffix}`]);
  ids.supplier = supplier.rows[0].id;
  const category = await pool.query(`INSERT INTO app.categories(category_code,category_name,status) VALUES($1,'Tax Category','ACTIVE') RETURNING id`, [`CAT-TAX-${suffix}`]);
  ids.category = category.rows[0].id;
  const product = await pool.query(`INSERT INTO app.products(sku,product_name,category_id,supplier_id,unit,purchase_price,selling_price,status) VALUES($1,'Tax Product',$2,$3,'PCS',50000,100000,'ACTIVE') RETURNING id`, [`SKU-TAX-${suffix}`,ids.category,ids.supplier]);
  ids.product = product.rows[0].id;
  const customer = await pool.query(`INSERT INTO app.customers(customer_code,customer_name,payment_terms_days,status) VALUES($1,'Tax Customer',30,'ACTIVE') RETURNING id`, [`CUS-TAX-${suffix}`]);
  ids.customer = customer.rows[0].id;
  const order = await pool.query(`INSERT INTO app.sales_orders(so_number,customer_id,status,approval_status) VALUES($1,$2,'DELIVERED','APPROVED') RETURNING id`, [`SO-TAX-${suffix}`,ids.customer]);
  ids.order = order.rows[0].id;
  await pool.query(`INSERT INTO app.sales_order_items(sales_order_id,product_id,quantity,unit_price,discount_amount) VALUES($1,$2,2,100000,20000)`, [ids.order,ids.product]);
});

after(async () => {
  try {
    if (ids.invoice) await pool.query(`DELETE FROM app.invoices WHERE id=$1`, [ids.invoice]);
    await pool.query(`DELETE FROM app.sales_order_items WHERE sales_order_id=$1`, [ids.order]);
    await pool.query(`DELETE FROM app.sales_orders WHERE id=$1`, [ids.order]);
    await pool.query(`DELETE FROM app.customers WHERE id=$1`, [ids.customer]);
    await pool.query(`DELETE FROM app.products WHERE id=$1`, [ids.product]);
    await pool.query(`DELETE FROM app.categories WHERE id=$1`, [ids.category]);
    await pool.query(`DELETE FROM app.suppliers WHERE id=$1`, [ids.supplier]);
    await pool.query(
      `UPDATE app.tax_settings SET is_enabled=$1,tax_name=$2,default_rate=$3,allow_invoice_override=$4,updated_by=$5 WHERE id=1`,
      [previousSettings.is_enabled,previousSettings.tax_name,previousSettings.default_rate,previousSettings.allow_invoice_override,previousSettings.updated_by],
    );
    await pool.query(`DELETE FROM app.users WHERE username=ANY($1::varchar[])`, [ids.usernames]);
  } finally { await pool.end(); }
});

test("tax settings apply the configured rate to new invoices and enforce RBAC", async () => {
  let response = await request(app).get("/api/tax-settings").set("Authorization", financeAuth);
  assert.equal(response.status, 200);

  response = await request(app).put("/api/tax-settings").set("Authorization", financeAuth).send({ is_enabled: true, tax_name: "PPN", default_rate: 11, allow_invoice_override: false });
  assert.equal(response.status, 403);

  response = await request(app).put("/api/tax-settings").set("Authorization", adminAuth).send({ is_enabled: true, tax_name: "PPN", default_rate: 11, allow_invoice_override: false });
  assert.equal(response.status, 200);

  response = await request(app).post("/api/invoices").set("Authorization", financeAuth).send({
    invoice_number: `INV-TAX-${suffix}`,
    sales_order_id: ids.order,
    tax_amount: 1,
  });
  assert.equal(response.status, 201);
  ids.invoice = response.body.data.id;
  assert.equal(Number(response.body.data.subtotal), 200000);
  assert.equal(Number(response.body.data.discount_amount), 20000);
  assert.equal(Number(response.body.data.tax_amount), 19800);
  assert.equal(Number(response.body.data.grand_total), 199800);
});
