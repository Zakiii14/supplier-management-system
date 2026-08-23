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
  username: `gr_admin_${suffix.toLowerCase()}`,
  email: `gr.${suffix.toLowerCase()}@local.test`,
  supplierCode: `GR-SUP-${suffix}`,
  categoryCode: `GR-CAT-${suffix}`,
  sku: `GR-SKU-${suffix}`,
  firstPoNumber: `GR-PO-A-${suffix}`,
  secondPoNumber: `GR-PO-B-${suffix}`,
  firstReceiptNumber: `GR-LIST-A-${suffix}`,
  secondReceiptNumber: `GR-LIST-B-${suffix}`,
};

const password =
  `GoodsReceipt-${randomBytes(16).toString("hex")}`;

const today = new Date()
  .toISOString()
  .slice(0, 10);

const expectedDate = new Date(
  Date.now() + 7 * 24 * 60 * 60 * 1000,
)
  .toISOString()
  .slice(0, 10);

const firstReceiptDate = "2026-01-15";
const secondReceiptDate = "2026-02-20";

let authorization;

before(async () => {
  const passwordHash = await bcrypt.hash(
    password,
    8,
  );

  const userResult = await pool.query(
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
      testData.username,
      `Goods Receipt Admin ${suffix}`,
      testData.email,
      passwordHash,
    ],
  );

  const userId = userResult.rows[0].id;

  let response = await request(app)
    .post("/api/auth/login")
    .send({
      identifier: testData.username,
      password,
    });

  assert.equal(response.status, 200);

  authorization =
    `Bearer ${response.body.data.access_token}`;

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
      `Goods Receipt Supplier ${suffix}`,
    ],
  );

  const supplierId =
    supplierResult.rows[0].id;

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
      `Goods Receipt Category ${suffix}`,
    ],
  );

  const categoryId =
    categoryResult.rows[0].id;

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
      minimum_stock
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      'PCS',
      5000,
      7500,
      2
    )
    RETURNING id
    `,
    [
      testData.sku,
      `Goods Receipt Product ${suffix}`,
      categoryId,
      supplierId,
    ],
  );

  const productId = productResult.rows[0].id;

  const firstPoResult = await pool.query(
    `
    INSERT INTO app.purchase_orders (
      po_number,
      supplier_id,
      order_date,
      expected_date,
      status,
      notes,
      created_by
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      'PARTIALLY_RECEIVED',
      $5,
      $6
    )
    RETURNING id
    `,
    [
      testData.firstPoNumber,
      supplierId,
      today,
      expectedDate,
      `First goods receipt PO ${suffix}`,
      userId,
    ],
  );

  const secondPoResult = await pool.query(
    `
    INSERT INTO app.purchase_orders (
      po_number,
      supplier_id,
      order_date,
      expected_date,
      status,
      notes,
      created_by
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      'RECEIVED',
      $5,
      $6
    )
    RETURNING id
    `,
    [
      testData.secondPoNumber,
      supplierId,
      today,
      expectedDate,
      `Second goods receipt PO ${suffix}`,
      userId,
    ],
  );

  const firstPoId = firstPoResult.rows[0].id;
  const secondPoId = secondPoResult.rows[0].id;

  const firstItemResult = await pool.query(
    `
    INSERT INTO app.purchase_order_items (
      purchase_order_id,
      product_id,
      quantity,
      unit_price
    )
    VALUES ($1, $2, 5, 5000)
    RETURNING id
    `,
    [firstPoId, productId],
  );

  const secondItemResult = await pool.query(
    `
    INSERT INTO app.purchase_order_items (
      purchase_order_id,
      product_id,
      quantity,
      unit_price
    )
    VALUES ($1, $2, 2, 5000)
    RETURNING id
    `,
    [secondPoId, productId],
  );

  const firstReceiptResult = await pool.query(
    `
    INSERT INTO app.goods_receipts (
      receipt_number,
      purchase_order_id,
      received_date,
      received_by,
      notes
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
    `,
    [
      testData.firstReceiptNumber,
      firstPoId,
      firstReceiptDate,
      userId,
      `First receipt note ${suffix}`,
    ],
  );

  const secondReceiptResult = await pool.query(
    `
    INSERT INTO app.goods_receipts (
      receipt_number,
      purchase_order_id,
      received_date,
      received_by,
      notes
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
    `,
    [
      testData.secondReceiptNumber,
      secondPoId,
      secondReceiptDate,
      userId,
      `Second receipt note ${suffix}`,
    ],
  );

  await pool.query(
    `
    INSERT INTO app.goods_receipt_items (
      goods_receipt_id,
      purchase_order_item_id,
      product_id,
      quantity_received,
      quantity_damaged
    )
    VALUES ($1, $2, $3, 4, 1)
    `,
    [
      firstReceiptResult.rows[0].id,
      firstItemResult.rows[0].id,
      productId,
    ],
  );

  await pool.query(
    `
    INSERT INTO app.goods_receipt_items (
      goods_receipt_id,
      purchase_order_item_id,
      product_id,
      quantity_received,
      quantity_damaged
    )
    VALUES ($1, $2, $3, 2, 0)
    `,
    [
      secondReceiptResult.rows[0].id,
      secondItemResult.rows[0].id,
      productId,
    ],
  );
});

after(async () => {
  try {
    const receiptNumbers = [
      testData.firstReceiptNumber,
      testData.secondReceiptNumber,
    ];

    const poNumbers = [
      testData.firstPoNumber,
      testData.secondPoNumber,
    ];

    await pool.query(
      `
      DELETE FROM app.goods_receipt_items
      WHERE goods_receipt_id IN (
        SELECT id
        FROM app.goods_receipts
        WHERE receipt_number =
          ANY($1::VARCHAR[])
      )
      `,
      [receiptNumbers],
    );

    await pool.query(
      `
      DELETE FROM app.goods_receipts
      WHERE receipt_number =
        ANY($1::VARCHAR[])
      `,
      [receiptNumbers],
    );

    await pool.query(
      `
      DELETE FROM app.purchase_order_items
      WHERE purchase_order_id IN (
        SELECT id
        FROM app.purchase_orders
        WHERE po_number =
          ANY($1::VARCHAR[])
      )
      `,
      [poNumbers],
    );

    await pool.query(
      `
      DELETE FROM app.purchase_orders
      WHERE po_number =
        ANY($1::VARCHAR[])
      `,
      [poNumbers],
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
      WHERE username = $1
      `,
      [testData.username],
    );
  } finally {
    await pool.end();
  }
});

test(
  "goods receipt list supports search, date range, and pagination",
  async () => {
    let response = await request(app)
      .get("/api/goods-receipts")
      .query({
        search: suffix,
        page: 1,
        limit: 1,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.pagination.page, 1);
    assert.equal(response.body.pagination.limit, 1);
    assert.equal(response.body.pagination.total, 2);
    assert.equal(
      response.body.pagination.total_pages,
      2,
    );

    response = await request(app)
      .get("/api/goods-receipts")
      .query({
        search: suffix,
        page: 2,
        limit: 1,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.pagination.page, 2);
    assert.equal(response.body.pagination.total, 2);

    response = await request(app)
      .get("/api/goods-receipts")
      .query({
        search: testData.firstReceiptNumber,
        page: 1,
        limit: 5,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(
      response.body.data[0].receipt_number,
      testData.firstReceiptNumber,
    );
    assert.equal(
      response.body.data[0].po_number,
      testData.firstPoNumber,
    );
    assert.equal(
      response.body.data[0].purchase_order_status,
      "PARTIALLY_RECEIVED",
    );
    assert.equal(
      Number(response.body.data[0].total_items),
      1,
    );
    assert.equal(
      Number(
        response.body.data[0]
          .total_quantity_received,
      ),
      4,
    );
    assert.equal(
      Number(
        response.body.data[0]
          .total_quantity_damaged,
      ),
      1,
    );
    assert.equal(
      response.body.data[0].received_by_name,
      `Goods Receipt Admin ${suffix}`,
    );

    response = await request(app)
      .get("/api/goods-receipts")
      .query({
        search: testData.supplierCode,
        page: 1,
        limit: 5,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 2);

    response = await request(app)
      .get("/api/goods-receipts")
      .query({
        search: suffix,
        date_from: firstReceiptDate,
        date_to: firstReceiptDate,
        page: 1,
        limit: 10,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.pagination.total, 1);
    assert.equal(
      response.body.data[0].receipt_number,
      testData.firstReceiptNumber,
    );

    response = await request(app)
      .get("/api/goods-receipts")
      .query({
        search: suffix,
        date_from: firstReceiptDate,
        date_to: secondReceiptDate,
        page: 1,
        limit: 10,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 2);
    assert.equal(response.body.pagination.total, 2);

    response = await request(app)
      .get("/api/goods-receipts")
      .query({
        search: suffix,
        date_from: "2026-03-01",
        page: 1,
        limit: 10,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 0);
    assert.equal(response.body.pagination.total, 0);

    response = await request(app)
      .get("/api/goods-receipts")
      .query({
        date_from: secondReceiptDate,
        date_to: firstReceiptDate,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "date_from cannot be later than date_to",
    );

    response = await request(app)
      .get("/api/goods-receipts")
      .query({
        page: 0,
        limit: 101,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Invalid pagination parameters",
    );
  },
);