const path = require("node:path");
const { randomBytes } = require("node:crypto");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env.test"),
  override: true,
});

if (
  process.env.DB_NAME !==
  "supplier_management_test"
) {
  throw new Error(
    "Integration tests must use supplier_management_test",
  );
}

const {
  test,
  before,
  after,
} = require("node:test");

const assert = require("node:assert/strict");
const request = require("supertest");
const bcrypt = require("bcryptjs");

const pool = require("../src/config/database");
const app = require("../src/app");

const suffix = randomBytes(4)
  .toString("hex")
  .toUpperCase();

const testData = {
  username: `product_admin_${suffix.toLowerCase()}`,
  email: `product.${suffix.toLowerCase()}@local.test`,
  supplierCode: `SKU-SUP-${suffix}`,
  categoryCode: `SKU-CAT-${suffix}`,
  primarySku: `SKU-CASE-${suffix}`,
  secondarySku: `SKU-SECOND-${suffix}`,
};

const password =
  `Product-${randomBytes(16).toString("hex")}`;

let supplierId;
let categoryId;

before(async () => {
  const passwordHash = await bcrypt.hash(
    password,
    8,
  );

  await pool.query(
    `
    INSERT INTO app.users (
      username,
      full_name,
      email,
      password_hash,
      role,
      status
    )
    VALUES (
      $1,
      'Product Test Admin',
      $2,
      $3,
      'ADMIN',
      'ACTIVE'
    )
    `,
    [
      testData.username,
      testData.email,
      passwordHash,
    ],
  );

  const supplierResult = await pool.query(
    `
    INSERT INTO app.suppliers (
      supplier_code,
      supplier_name,
      status
    )
    VALUES ($1, 'SKU Test Supplier', 'ACTIVE')
    RETURNING id
    `,
    [testData.supplierCode],
  );

  supplierId = supplierResult.rows[0].id;

  const categoryResult = await pool.query(
    `
    INSERT INTO app.categories (
      category_code,
      category_name,
      status
    )
    VALUES ($1, 'SKU Test Category', 'ACTIVE')
    RETURNING id
    `,
    [testData.categoryCode],
  );

  categoryId = categoryResult.rows[0].id;
});

after(async () => {
  try {
    await pool.query(
      `
      DELETE FROM app.products
      WHERE UPPER(sku) = ANY($1::VARCHAR[])
      `,
      [[
        testData.primarySku,
        testData.secondarySku,
      ]],
    );

    await pool.query(
      `
      DELETE FROM app.categories
      WHERE category_code = $1
      `,
      [testData.categoryCode],
    );

    await pool.query(
      `
      DELETE FROM app.suppliers
      WHERE supplier_code = $1
      `,
      [testData.supplierCode],
    );

    await pool.query(
      `
      DELETE FROM app.users
      WHERE username = $1
      `,
      [testData.username],
    );
  } finally {
    await pool.end();
  }
});

test(
  "product SKU is uppercase and case-insensitively unique",
  async () => {
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        identifier: testData.username,
        password,
      });

    assert.equal(loginResponse.status, 200);

    const authorization =
      `Bearer ${loginResponse.body.data.access_token}`;

    let response = await request(app)
      .post("/api/products")
      .set("Authorization", authorization)
      .send({
        sku: testData.primarySku.toLowerCase(),
        product_name: "Primary SKU Product",
        category_id: categoryId,
        supplier_id: supplierId,
        unit: "PCS",
        purchase_price: 10000,
        selling_price: 15000,
        minimum_stock: 5,
      });

    assert.equal(response.status, 201);
    assert.equal(
      response.body.data.sku,
      testData.primarySku,
    );

    response = await request(app)
      .post("/api/products")
      .set("Authorization", authorization)
      .send({
        sku: testData.primarySku.toLowerCase(),
        product_name: "Duplicate SKU Product",
        category_id: categoryId,
        supplier_id: supplierId,
        unit: "PCS",
        purchase_price: 10000,
        selling_price: 15000,
        minimum_stock: 5,
      });

    assert.equal(response.status, 409);
    assert.equal(
      response.body.message,
      "SKU already exists",
    );

    response = await request(app)
      .post("/api/products")
      .set("Authorization", authorization)
      .send({
        sku: testData.secondarySku,
        product_name: "Secondary SKU Product",
        category_id: categoryId,
        supplier_id: supplierId,
        unit: "PCS",
        purchase_price: 12000,
        selling_price: 17000,
        minimum_stock: 3,
      });

    assert.equal(response.status, 201);

    const secondaryProductId =
      response.body.data.id;

    response = await request(app)
      .put(`/api/products/${secondaryProductId}`)
      .set("Authorization", authorization)
      .send({
        sku: testData.primarySku.toLowerCase(),
        product_name: "Secondary SKU Product",
        category_id: categoryId,
        supplier_id: supplierId,
        unit: "PCS",
        purchase_price: 12000,
        selling_price: 17000,
        minimum_stock: 3,
      });

    assert.equal(response.status, 409);
    assert.equal(
      response.body.message,
      "SKU already exists",
    );
  },
);