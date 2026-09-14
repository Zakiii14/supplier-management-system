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
  const quarantineProduct = await pool.query(`INSERT INTO app.products(sku,product_name,category_id,supplier_id,unit,purchase_price,selling_price,current_stock,status) VALUES($1,'SR Quarantine Product',$2,$3,'PCS',10000,20000,7,'ACTIVE') RETURNING id`, [code("SKUQ"),ids.category,ids.supplier]);
  ids.quarantineProduct = quarantineProduct.rows[0].id;
  const damagedProduct = await pool.query(`INSERT INTO app.products(sku,product_name,category_id,supplier_id,unit,purchase_price,selling_price,current_stock,status) VALUES($1,'SR Damaged Product',$2,$3,'PCS',10000,20000,7,'ACTIVE') RETURNING id`, [code("SKUD"),ids.category,ids.supplier]);
  ids.damagedProduct = damagedProduct.rows[0].id;
  const customer = await pool.query(`INSERT INTO app.customers(customer_code,customer_name,status) VALUES($1,'SR Customer','ACTIVE') RETURNING id`, [code("CUS")]);
  ids.customer = customer.rows[0].id;
  const order = await pool.query(`INSERT INTO app.sales_orders(so_number,customer_id,status,approval_status) VALUES($1,$2,'DELIVERED','APPROVED') RETURNING id`, [code("SO"),ids.customer]);
  ids.order = order.rows[0].id;
  const orderItem = await pool.query(`INSERT INTO app.sales_order_items(sales_order_id,product_id,quantity,unit_price,discount_amount) VALUES($1,$2,10,20000,0) RETURNING id`, [ids.order,ids.product]);
  ids.orderItem = orderItem.rows[0].id;
  const quarantineOrderItem = await pool.query(`INSERT INTO app.sales_order_items(sales_order_id,product_id,quantity,unit_price,discount_amount) VALUES($1,$2,10,20000,0) RETURNING id`, [ids.order,ids.quarantineProduct]);
  ids.quarantineOrderItem = quarantineOrderItem.rows[0].id;
  const damagedOrderItem = await pool.query(`INSERT INTO app.sales_order_items(sales_order_id,product_id,quantity,unit_price,discount_amount) VALUES($1,$2,10,20000,0) RETURNING id`, [ids.order,ids.damagedProduct]);
  ids.damagedOrderItem = damagedOrderItem.rows[0].id;
  const delivery = await pool.query(`INSERT INTO app.deliveries(delivery_number,sales_order_id,status,delivered_at) VALUES($1,$2,'DELIVERED',NOW()) RETURNING id`, [code("DEL"),ids.order]);
  ids.delivery = delivery.rows[0].id;
  await pool.query(`INSERT INTO app.delivery_items(delivery_id,sales_order_item_id,product_id,quantity_delivered) VALUES($1,$2,$3,10)`, [ids.delivery,ids.orderItem,ids.product]);
  await pool.query(`INSERT INTO app.delivery_items(delivery_id,sales_order_item_id,product_id,quantity_delivered) VALUES($1,$2,$3,10)`, [ids.delivery,ids.quarantineOrderItem,ids.quarantineProduct]);
  await pool.query(`INSERT INTO app.delivery_items(delivery_id,sales_order_item_id,product_id,quantity_delivered) VALUES($1,$2,$3,10)`, [ids.delivery,ids.damagedOrderItem,ids.damagedProduct]);
  const invoice = await pool.query(`INSERT INTO app.invoices(invoice_number,sales_order_id,customer_id,due_date,subtotal,grand_total,paid_amount,status) VALUES($1,$2,$3,CURRENT_DATE+30,200000,200000,0,'UNPAID') RETURNING id`, [code("INV"),ids.order,ids.customer]);
  ids.invoice = invoice.rows[0].id;
});

after(async () => {
  try {
    if (ids.inspection) {
      await pool.query(`DELETE FROM app.inventory_movements WHERE reference_type='STOCK_INSPECTION' AND reference_id=$1`, [ids.inspection]);
      await pool.query(`DELETE FROM app.inventory_stock_inspections WHERE id=$1`, [ids.inspection]);
    }
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
    await pool.query(`DELETE FROM app.products WHERE id=ANY($1::uuid[])`, [[ids.product,ids.quarantineProduct,ids.damagedProduct]]);
    await pool.query(`DELETE FROM app.categories WHERE id=$1`, [ids.category]);
    await pool.query(`DELETE FROM app.suppliers WHERE id=$1`, [ids.supplier]);
    await pool.query(`DELETE FROM app.users WHERE username=ANY($1::varchar[])`, [ids.usernames]);
  } finally { await pool.end(); }
});

test("sales return routes returned items into inventory buckets by condition", async () => {
  let response = await request(app).get(`/api/sales-returns/deliveries/${ids.delivery}/items`).set("Authorization", salesAuth);
  assert.equal(response.status, 200);
  assert.equal(Number(response.body.data.items[0].returnable_quantity), 10);

  response = await request(app).post("/api/sales-returns").set("Authorization", salesAuth).send({
    delivery_id: ids.delivery, reason: "DAMAGED",
    items: [
      { product_id: ids.product, quantity: 1, item_condition: "SALEABLE" },
      { product_id: ids.quarantineProduct, quantity: 1, item_condition: "QUARANTINE" },
      { product_id: ids.damagedProduct, quantity: 1, item_condition: "DAMAGED" },
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

  const products = await pool.query(`SELECT id,current_stock,quarantine_stock,damaged_stock FROM app.products WHERE id=ANY($1::uuid[])`, [[ids.product,ids.quarantineProduct,ids.damagedProduct]]);
  const productsById = new Map(products.rows.map((row) => [row.id, row]));
  assert.equal(Number(productsById.get(ids.product).current_stock), 8);
  assert.equal(Number(productsById.get(ids.quarantineProduct).current_stock), 7);
  assert.equal(Number(productsById.get(ids.quarantineProduct).quarantine_stock), 1);
  assert.equal(Number(productsById.get(ids.damagedProduct).current_stock), 7);
  assert.equal(Number(productsById.get(ids.damagedProduct).damaged_stock), 1);
  const movements = await pool.query(`SELECT movement_type,quantity,stock_bucket FROM app.inventory_movements WHERE reference_type='SALES_RETURN' AND reference_id=$1`, [ids.return]);
  assert.equal(movements.rows.length, 3);
  const movementsByBucket = new Map(movements.rows.map((row) => [row.stock_bucket, row]));
  for (const bucket of ["AVAILABLE","QUARANTINE","DAMAGED"]) {
    assert.equal(movementsByBucket.get(bucket).movement_type, "RETURN_IN");
    assert.equal(Number(movementsByBucket.get(bucket).quantity), 1);
  }

  response = await request(app).get("/api/inventory-movements/quarantine-stocks").set("Authorization", managerAuth);
  assert.equal(response.status, 200);
  assert.ok(response.body.data.some((item) => item.id === ids.quarantineProduct && Number(item.quarantine_stock) === 1));

  response = await request(app).post("/api/inventory-movements/stock-inspections").set("Authorization", managerAuth).send({
    product_id: ids.quarantineProduct,
    quantity: 1,
    target_bucket: "AVAILABLE",
    notes: "Layak dijual setelah pemeriksaan",
  });
  assert.equal(response.status, 201);
  ids.inspection = response.body.data.id;

  const inspectedProduct = await pool.query(`SELECT current_stock,quarantine_stock FROM app.products WHERE id=$1`, [ids.quarantineProduct]);
  assert.equal(Number(inspectedProduct.rows[0].current_stock), 8);
  assert.equal(Number(inspectedProduct.rows[0].quarantine_stock), 0);
  const inspectionMovements = await pool.query(`SELECT movement_type,stock_bucket FROM app.inventory_movements WHERE reference_type='STOCK_INSPECTION' AND reference_id=$1 ORDER BY movement_type`, [ids.inspection]);
  assert.deepEqual(inspectionMovements.rows, [
    { movement_type: "ADJUSTMENT_IN", stock_bucket: "AVAILABLE" },
    { movement_type: "ADJUSTMENT_OUT", stock_bucket: "QUARANTINE" },
  ]);
});

test("sales return credit keeps an unpaid invoice unpaid and blocks duplicate excess settlement", async () => {
  let response = await request(app).get(`/api/sales-returns/${ids.return}/settlement-invoices`).set("Authorization", financeAuth);
  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].scope, "SAME_SO");
  assert.equal(Number(response.body.data[0].outstanding_amount), 200000);

  response = await request(app).post(`/api/sales-returns/${ids.return}/settlements`).set("Authorization", financeAuth).send({ settlement_type: "INVOICE_DEDUCTION", invoice_id: ids.invoice, amount: 50000 });
  assert.equal(response.status, 201);
  const invoice = await pool.query(`SELECT credit_amount,grand_total-paid_amount-credit_amount outstanding,status FROM app.invoices WHERE id=$1`, [ids.invoice]);
  assert.equal(Number(invoice.rows[0].credit_amount), 50000);
  assert.equal(Number(invoice.rows[0].outstanding), 150000);
  assert.equal(invoice.rows[0].status, "UNPAID");

  response = await request(app).post(`/api/sales-returns/${ids.return}/settlements`).set("Authorization", financeAuth).send({ settlement_type: "REPLACEMENT", amount: 20000 });
  assert.equal(response.status, 409);
});
