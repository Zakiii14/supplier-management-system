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
  adminUsername:
    `inventory_admin_${suffix.toLowerCase()}`,
  adminEmail:
    `inventory.admin.${suffix.toLowerCase()}@local.test`,
  salesUsername:
    `inventory_sales_${suffix.toLowerCase()}`,
  salesEmail:
    `inventory.sales.${suffix.toLowerCase()}@local.test`,
  supplierCode: `INV-SUP-${suffix}`,
  categoryCode: `INV-CAT-${suffix}`,
  sku: `INV-SKU-${suffix}`,
};

const password =
  `Inventory-${randomBytes(16).toString("hex")}`;

let adminAuthorization;
let salesAuthorization;
let adminId;
let productId;
let purchaseMovementId;

const login = async (username) => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({
      identifier: username,
      password,
    });

  assert.equal(response.status, 200);

  return `Bearer ${response.body.data.access_token}`;
};

before(async () => {
  const passwordHash = await bcrypt.hash(
    password,
    8,
  );

  const adminResult = await pool.query(
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
      $2,
      $3,
      $4,
      'ADMIN',
      'ACTIVE'
    )
    RETURNING id
    `,
    [
      testData.adminUsername,
      `Inventory Admin ${suffix}`,
      testData.adminEmail,
      passwordHash,
    ],
  );

  adminId = adminResult.rows[0].id;

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
      $2,
      $3,
      $4,
      'SALES',
      'ACTIVE'
    )
    `,
    [
      testData.salesUsername,
      `Inventory Sales ${suffix}`,
      testData.salesEmail,
      passwordHash,
    ],
  );

  adminAuthorization = await login(
    testData.adminUsername,
  );

  salesAuthorization = await login(
    testData.salesUsername,
  );

  const supplierResult = await pool.query(
    `
    INSERT INTO app.suppliers (
      supplier_code,
      supplier_name,
      payment_terms_days
    )
    VALUES ($1, $2, 14)
    RETURNING id
    `,
    [
      testData.supplierCode,
      `Inventory Supplier ${suffix}`,
    ],
  );

  const categoryResult = await pool.query(
    `
    INSERT INTO app.categories (
      category_code,
      category_name
    )
    VALUES ($1, $2)
    RETURNING id
    `,
    [
      testData.categoryCode,
      `Inventory Category ${suffix}`,
    ],
  );

  const productResult = await pool.query(
    `
    INSERT INTO app.products (
      sku,
      product_name,
      category_id,
      supplier_id,
      unit,
      purchase_price,
      selling_price,
      minimum_stock,
      current_stock
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      'PCS',
      5000,
      7500,
      2,
      9
    )
    RETURNING id
    `,
    [
      testData.sku,
      `Inventory Product ${suffix}`,
      categoryResult.rows[0].id,
      supplierResult.rows[0].id,
    ],
  );

  productId = productResult.rows[0].id;

  const purchaseMovementResult =
    await pool.query(
      `
      INSERT INTO app.inventory_movements (
        product_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        movement_date,
        notes,
        created_by
      )
      VALUES (
        $1,
        'PURCHASE_RECEIPT',
        12,
        'INVENTORY_TEST',
        gen_random_uuid(),
        NOW() - INTERVAL '1 minute',
        $2,
        $3
      )
      RETURNING id
      `,
      [
        productId,
        `Inventory purchase ${suffix}`,
        adminId,
      ],
    );

  purchaseMovementId =
    purchaseMovementResult.rows[0].id;

  await pool.query(
    `
    INSERT INTO app.inventory_movements (
      product_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      movement_date,
      notes,
      created_by
    )
    VALUES (
      $1,
      'SALES_ISSUE',
      3,
      'INVENTORY_TEST',
      gen_random_uuid(),
      NOW(),
      $2,
      $3
    )
    `,
    [
      productId,
      `Inventory sales ${suffix}`,
      adminId,
    ],
  );
});

after(async () => {
  try {
    await pool.query(
      `
      DELETE FROM app.inventory_movements
      WHERE product_id IN (
        SELECT id
        FROM app.products
        WHERE sku = $1
      )
      `,
      [testData.sku],
    );

    await pool.query(
      `
      DELETE FROM app.products
      WHERE sku = $1
      `,
      [testData.sku],
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
      WHERE username =
        ANY($1::VARCHAR[])
      `,
      [[
        testData.adminUsername,
        testData.salesUsername,
      ]],
    );
  } finally {
    await pool.end();
  }
});

test(
  "inventory movement list and detail support filters, pagination, and RBAC",
  async () => {
    let response = await request(app)
      .get("/api/inventory-movements")
      .query({
        search: suffix,
        page: 1,
        limit: 1,
      })
      .set(
        "Authorization",
        adminAuthorization,
      );

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.pagination.page, 1);
    assert.equal(response.body.pagination.limit, 1);
    assert.equal(
      response.body.pagination.total_data,
      2,
    );
    assert.equal(
      response.body.pagination.total_pages,
      2,
    );

    response = await request(app)
      .get("/api/inventory-movements")
      .query({
        search: suffix,
        page: 2,
        limit: 1,
      })
      .set(
        "Authorization",
        adminAuthorization,
      );

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.pagination.page, 2);

    response = await request(app)
      .get("/api/inventory-movements")
      .query({
        search: `Inventory purchase ${suffix}`,
        movement_type: "PURCHASE_RECEIPT",
        product_id: productId,
        page: 1,
        limit: 10,
      })
      .set(
        "Authorization",
        adminAuthorization,
      );

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(
      response.body.data[0].id,
      purchaseMovementId,
    );
    assert.equal(
      response.body.data[0].sku,
      testData.sku,
    );
    assert.equal(
      response.body.data[0].movement_type,
      "PURCHASE_RECEIPT",
    );
    assert.equal(
      Number(response.body.data[0].quantity),
      12,
    );
    assert.equal(
      response.body.data[0].created_by,
      adminId,
    );

    response = await request(app)
      .get(
        `/api/inventory-movements/${purchaseMovementId}`,
      )
      .set(
        "Authorization",
        adminAuthorization,
      );

    assert.equal(response.status, 200);
    assert.equal(
      response.body.data.id,
      purchaseMovementId,
    );
    assert.equal(
      response.body.data.product_id,
      productId,
    );
    assert.equal(
      response.body.data.reference_type,
      "INVENTORY_TEST",
    );

    response = await request(app)
      .get(
        "/api/inventory-movements/00000000-0000-0000-0000-000000000000",
      )
      .set(
        "Authorization",
        adminAuthorization,
      );

    assert.equal(response.status, 404);
    assert.equal(
      response.body.message,
      "Inventory movement not found",
    );

    response = await request(app)
      .get("/api/inventory-movements")
      .set(
        "Authorization",
        salesAuthorization,
      );

    assert.equal(response.status, 403);
  },
);