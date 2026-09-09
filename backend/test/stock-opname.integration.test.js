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
const password = `Stock-${randomBytes(12).toString("hex")}`;
const data = {
  warehouse: `stock_wh_${suffix.toLowerCase()}`,
  manager: `stock_mgr_${suffix.toLowerCase()}`,
  supplier: `ST-SUP-${suffix}`,
  category: `ST-CAT-${suffix}`,
  sku: `ST-SKU-${suffix}`,
};

let warehouseAuth;
let managerAuth;
let productId;
let opnameId;

before(async () => {
  const hash = await bcrypt.hash(password, 8);
  const users = await pool.query(
    `INSERT INTO app.users(username,full_name,email,password_hash,role,status)
     VALUES($1,'Stock Warehouse',$2,$3,'WAREHOUSE','ACTIVE'),
           ($4,'Stock Manager',$5,$3,'MANAGER','ACTIVE') RETURNING id,username`,
    [data.warehouse, `${data.warehouse}@local.test`, hash, data.manager, `${data.manager}@local.test`],
  );
  for (const username of [data.warehouse, data.manager]) {
    const login = await request(app).post("/api/auth/login").send({ identifier: username, password });
    assert.equal(login.status, 200);
    if (username === data.warehouse) warehouseAuth = `Bearer ${login.body.data.access_token}`;
    else managerAuth = `Bearer ${login.body.data.access_token}`;
  }
  const supplier = await pool.query(
    `INSERT INTO app.suppliers(supplier_code,supplier_name,status) VALUES($1,'Stock Supplier','ACTIVE') RETURNING id`,
    [data.supplier],
  );
  const category = await pool.query(
    `INSERT INTO app.categories(category_code,category_name,status) VALUES($1,'Stock Category','ACTIVE') RETURNING id`,
    [data.category],
  );
  const product = await pool.query(
    `INSERT INTO app.products(sku,product_name,category_id,supplier_id,unit,current_stock,status)
     VALUES($1,'Stock Product',$2,$3,'PCS',10,'ACTIVE') RETURNING id`,
    [data.sku, category.rows[0].id, supplier.rows[0].id],
  );
  productId = product.rows[0].id;
});

after(async () => {
  try {
    if (opnameId) {
      await pool.query(`DELETE FROM app.inventory_movements WHERE reference_type='STOCK_OPNAME' AND reference_id=$1`, [opnameId]);
      await pool.query(`DELETE FROM app.transaction_approvals WHERE transaction_type='STOCK_OPNAME' AND transaction_id=$1`, [opnameId]);
      await pool.query(`DELETE FROM app.stock_opnames WHERE id=$1`, [opnameId]);
    }
    await pool.query(`DELETE FROM app.products WHERE sku=$1`, [data.sku]);
    await pool.query(`DELETE FROM app.categories WHERE category_code=$1`, [data.category]);
    await pool.query(`DELETE FROM app.suppliers WHERE supplier_code=$1`, [data.supplier]);
    await pool.query(`DELETE FROM app.users WHERE username=ANY($1::varchar[])`, [[data.warehouse, data.manager]]);
  } finally {
    await pool.end();
  }
});

test("stock opname creates a snapshot, enforces separation of duties, and adjusts inventory after approval", async () => {
  let response = await request(app)
    .post("/api/stock-opnames")
    .set("Authorization", warehouseAuth)
    .send({ opname_date: new Date().toISOString().slice(0, 10), notes: "Penghitungan berkala", items: [{ product_id: productId, counted_quantity: 7, notes: "Tiga unit tidak ditemukan" }] });

  assert.equal(response.status, 201);
  assert.match(response.body.data.opname_number, /^SOF-/);
  assert.equal(response.body.data.status, "DRAFT");
  assert.equal(Number(response.body.data.items[0].system_quantity), 10);
  assert.equal(Number(response.body.data.items[0].variance), -3);
  opnameId = response.body.data.id;

  response = await request(app).post(`/api/stock-opnames/${opnameId}/submit`).set("Authorization", warehouseAuth).send();
  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, "PENDING");

  response = await request(app).post(`/api/stock-opnames/${opnameId}/decision`).set("Authorization", warehouseAuth).send({ decision: "APPROVED" });
  assert.equal(response.status, 403);

  response = await request(app).post(`/api/stock-opnames/${opnameId}/decision`).set("Authorization", managerAuth).send({ decision: "APPROVED" });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, "APPROVED");

  const product = await pool.query(`SELECT current_stock FROM app.products WHERE id=$1`, [productId]);
  assert.equal(Number(product.rows[0].current_stock), 7);
  const movement = await pool.query(`SELECT movement_type,quantity FROM app.inventory_movements WHERE reference_type='STOCK_OPNAME' AND reference_id=$1`, [opnameId]);
  assert.equal(movement.rows.length, 1);
  assert.equal(movement.rows[0].movement_type, "ADJUSTMENT_OUT");
  assert.equal(Number(movement.rows[0].quantity), 3);

  response = await request(app).get(`/api/stock-opnames/${opnameId}`).set("Authorization", warehouseAuth);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.approval_history.map((entry) => entry.action), ["APPROVED", "SUBMITTED"]);
});

test("stock opname validates filters and identifiers", async () => {
  let response = await request(app).get("/api/stock-opnames").query({ status: "UNKNOWN" }).set("Authorization", managerAuth);
  assert.equal(response.status, 400);
  response = await request(app).get("/api/stock-opnames/not-a-uuid").set("Authorization", managerAuth);
  assert.equal(response.status, 400);
});
