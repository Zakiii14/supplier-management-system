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
const password = `SalesReturn-${randomBytes(8).toString("hex")}`;
const code = (prefix) => `${prefix}-${suffix}`;
const ids = {};
let salesAuth; let managerAuth; let financeAuth;

before(async () => {
  const hash = await bcrypt.hash(password, 8);
  const usernames = [`sr_sales_${suffix.toLowerCase()}`, `sr_manager_${suffix.toLowerCase()}`, `sr_finance_${suffix.toLowerCase()}`];
  await pool.query(
    `INSERT INTO app.users(username,full_name,email,password_hash,role,status)
     VALUES($1,'Sales Return Sales',$2,$4,'SALES','ACTIVE'),
           ($3,'Sales Return Manager',$5,$4,'MANAGER','ACTIVE'),
           ($6,'Sales Return Finance',$7,$4,'FINANCE','ACTIVE')`,
    [usernames[0], `${usernames[0]}@local.test`, usernames[1], hash, `${usernames[1]}@local.test`, usernames[2], `${usernames[2]}@local.test`],
  );
  ids.usernames = usernames;
  for (const username of usernames) {
    const login = await request(app).post("/api/auth/login").send({ identifier: username, password });
    assert.equal(login.status, 200);
    const auth = `Bearer ${login.body.data.access_token}`;
    if (username === usernames[0]) salesAuth = auth;
    else if (username === usernames[1]) managerAuth = auth;
    else financeAuth = auth;
  }
  const supplier = await pool.query(`INSERT INTO app.suppliers(supplier_code,supplier_name,status) VALUES($1,'SR Supplier','ACTIVE') RETURNING id`, [code("SUP")]);
  ids.supplier = supplier.rows[0].id;
  const category = await pool.query(`INSERT INTO app.categories(category_code,category_name,status) VALUES($1,'SR Category','ACTIVE') RETURNING id`, [code("CAT")]);
  ids.category = category.rows[0].id;
  const product = await pool.query(`INSERT INTO app.products(sku,product_name,category_id,supplier_id,unit,purchase_price,selling_price,current_stock,status) VALUES($1,'SR Product',$2,$3,'PCS',10000,20000,7,'ACTIVE') RETURNING id`, [code("SKU"),ids.category,ids.supplier]);
  ids.product = product.rows[0].id;
  const customer = await pool.query(`INSERT INTO app.customers(customer_code,customer_name,status) VALUES($1,'SR Customer','ACTIVE') RETURNING id`, [code("CUS")]);
  ids.customer = customer.rows[0].id;
  const order = await pool.query(`INSERT INTO app.sales_orders(so_number,customer_id,status,approval_status) VALUES($1,$2,'DELIVERED','APPROVED') RETURNING id`, [code("SO"),ids.customer]);
  ids.order = order.rows[0].id;
  const orderItem = await pool.query(`INSERT INTO app.sales_order_items(sales_order_id,product_id,quantity,unit_price,discount_amount) VALUES($1,$2,10,20000,0) RETURNING id`, [ids.order,ids.product]);
  ids.orderItem = orderItem.rows[0].id;
  const delivery = await pool.query(`INSERT INTO app.deliveries(delivery_number,sales_order_id,status,delivered_at) VALUES($1,$2,'DELIVERED',NOW()) RETURNING id`, [code("DEL"),ids.order]);
  ids.delivery = delivery.rows[0].id;
  await pool.query(`INSERT INTO app.delivery_items(delivery_id,sales_order_item_id,product_id,quantity_delivered) VALUES($1,$2,$3,10)`, [ids.delivery,ids.orderItem,ids.product]);
  const invoice = await pool.query(`INSERT INTO app.invoices(invoice_number,sales_order_id,customer_id,due_date,subtotal,grand_total,paid_amount,status) VALUES($1,$2,$3,CURRENT_DATE+30,200000,200000,100000,'PARTIAL') RETURNING id`, [code("INV"),ids.order,ids.customer]);
  ids.invoice = invoice.rows[0].id;
  await pool.query(`INSERT INTO app.payments(payment_number,invoice_id,amount,method) VALUES($1,$2,100000,'BANK_TRANSFER')`, [code("PAY"),ids.invoice]);
});

after(async () => {
  try {
    if (ids.return) {
      await pool.query(`DELETE FROM app.sales_return_settlements WHERE sales_return_id=$1`, [ids.return]);
      await pool.query(`DELETE FROM app.inventory_movements WHERE reference_type='SALES_RETURN' AND reference_id=$1`, [ids.return]);
      await pool.query(`DELETE FROM app.transaction_approvals WHERE transaction_type='SALES_RETURN' AND transaction_id=$1`, [ids.return]);
      await pool.query(`DELETE FROM app.sales_returns WHERE id=$1`, [ids.return]);
    }
    await pool.query(`DELETE FROM app.payments WHERE invoice_id=$1`, [ids.invoice]);
    await pool.query(`DELETE FROM app.invoices WHERE id=$1`, [ids.invoice]);
    await pool.query(`DELETE FROM app.delivery_items WHERE delivery_id=$1`, [ids.delivery]);
    await pool.query(`DELETE FROM app.deliveries WHERE id=$1`, [ids.delivery]);
    await pool.query(`DELETE FROM app.sales_order_items WHERE sales_order_id=$1`, [ids.order]);
    await pool.query(`DELETE FROM app.sales_orders WHERE id=$1`, [ids.order]);
    await pool.query(`DELETE FROM app.customers WHERE id=$1`, [ids.customer]);
    await pool.query(`DELETE FROM app.products WHERE id=$1`, [ids.product]);
    await pool.query(`DELETE FROM app.categories WHERE id=$1`, [ids.category]);
    await pool.query(`DELETE FROM app.suppliers WHERE id=$1`, [ids.supplier]);
    await pool.query(`DELETE FROM app.users WHERE username=ANY($1::varchar[])`, [ids.usernames]);
  } finally { await pool.end(); }
});

test("sales return reserves delivered quantities and only restocks saleable items", async () => {
  let response = await request(app).get(`/api/sales-returns/deliveries/${ids.delivery}/items`).set("Authorization", salesAuth);
  assert.equal(response.status, 200);
  assert.equal(Number(response.body.data.items[0].returnable_quantity), 10);

  response = await request(app).post("/api/sales-returns").set("Authorization", salesAuth).send({
    delivery_id: ids.delivery, reason: "DAMAGED",
    items: [
      { product_id: ids.product, quantity: 3, item_condition: "SALEABLE" },
    ],
  });
  assert.equal(response.status, 201);
  assert.match(response.body.data.return_number, /^SRT-/);
  ids.return = response.body.data.id;

  response = await request(app).post(`/api/sales-returns/${ids.return}/submit`).set("Authorization", salesAuth);
  assert.equal(response.status, 200);
  response = await request(app).post(`/api/sales-returns/${ids.return}/decision`).set("Authorization", salesAuth).send({ decision: "APPROVED" });
  assert.equal(response.status, 403);
  response = await request(app).post(`/api/sales-returns/${ids.return}/decision`).set("Authorization", managerAuth).send({ decision: "APPROVED" });
  assert.equal(response.status, 200);

  const product = await pool.query(`SELECT current_stock FROM app.products WHERE id=$1`, [ids.product]);
  assert.equal(Number(product.rows[0].current_stock), 10);
  const movement = await pool.query(`SELECT movement_type,quantity FROM app.inventory_movements WHERE reference_type='SALES_RETURN' AND reference_id=$1`, [ids.return]);
  assert.equal(movement.rows[0].movement_type, "RETURN_IN");
  assert.equal(Number(movement.rows[0].quantity), 3);
});

test("sales return credit reduces invoice outstanding and blocks duplicate excess settlement", async () => {
  let response = await request(app).get(`/api/sales-returns/${ids.return}/settlement-invoices`).set("Authorization", financeAuth);
  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].scope, "SAME_SO");
  assert.equal(Number(response.body.data[0].outstanding_amount), 100000);

  response = await request(app).post(`/api/sales-returns/${ids.return}/settlements`).set("Authorization", financeAuth).send({ settlement_type: "INVOICE_DEDUCTION", invoice_id: ids.invoice, amount: 50000 });
  assert.equal(response.status, 201);
  const invoice = await pool.query(`SELECT credit_amount,grand_total-paid_amount-credit_amount outstanding FROM app.invoices WHERE id=$1`, [ids.invoice]);
  assert.equal(Number(invoice.rows[0].credit_amount), 50000);
  assert.equal(Number(invoice.rows[0].outstanding), 50000);

  response = await request(app).post(`/api/sales-returns/${ids.return}/settlements`).set("Authorization", financeAuth).send({ settlement_type: "REPLACEMENT", amount: 20000 });
  assert.equal(response.status, 409);
});
