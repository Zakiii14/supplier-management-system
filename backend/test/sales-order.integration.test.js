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
  username: `so_admin_${suffix.toLowerCase()}`,
  email: `so.${suffix.toLowerCase()}@local.test`,
  supplierCode: `SO-SUP-${suffix}`,
  categoryCode: `SO-CAT-${suffix}`,
  sku: `SO-SKU-${suffix}`,
  customerCode: `SO-CUS-${suffix}`,
  firstSoNumber: `SO-LIST-A-${suffix}`,
  secondSoNumber: `SO-LIST-B-${suffix}`,
};

const password =
  `SalesOrder-${randomBytes(16).toString("hex")}`;

const today = new Date()
  .toISOString()
  .slice(0, 10);

const requestedDeliveryDate = new Date(
  Date.now() + 7 * 24 * 60 * 60 * 1000,
)
  .toISOString()
  .slice(0, 10);

let authorization;
let customerId;
let productId;

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
      'Sales Order Test Admin',
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

  let response = await request(app)
    .post("/api/auth/login")
    .send({
      identifier: testData.username,
      password,
    });

  assert.equal(response.status, 200);

  authorization =
    `Bearer ${response.body.data.access_token}`;

  response = await request(app)
    .post("/api/suppliers")
    .set("Authorization", authorization)
    .send({
      supplier_code: testData.supplierCode,
      supplier_name:
        `Sales Order Supplier ${suffix}`,
      payment_terms_days: 14,
    });

  assert.equal(response.status, 201);

  const supplierId = response.body.data.id;

  response = await request(app)
    .post("/api/categories")
    .set("Authorization", authorization)
    .send({
      category_code: testData.categoryCode,
      category_name:
        `Sales Order Category ${suffix}`,
    });

  assert.equal(response.status, 201);

  const categoryId = response.body.data.id;

  response = await request(app)
    .post("/api/products")
    .set("Authorization", authorization)
    .send({
      sku: testData.sku,
      product_name:
        `Sales Order Product ${suffix}`,
      category_id: categoryId,
      supplier_id: supplierId,
      unit: "PCS",
      purchase_price: 5000,
      selling_price: 7500,
      minimum_stock: 2,
    });

  assert.equal(response.status, 201);

  productId = response.body.data.id;

  await pool.query(
    `
    UPDATE app.products
    SET current_stock = 100
    WHERE id = $1
    `,
    [productId],
  );

  response = await request(app)
    .post("/api/customers")
    .set("Authorization", authorization)
    .send({
      customer_code: testData.customerCode,
      customer_name:
        `Sales Order Customer ${suffix}`,
      payment_terms_days: 14,
      credit_limit: 10000000,
    });

  assert.equal(response.status, 201);

  customerId = response.body.data.id;

  response = await request(app)
    .post("/api/sales-orders")
    .set("Authorization", authorization)
    .send({
      so_number: testData.firstSoNumber,
      customer_id: customerId,
      order_date: today,
      requested_delivery_date:
        requestedDeliveryDate,
      notes: `First sales order ${suffix}`,
      items: [
        {
          product_id: productId,
          quantity: 2,
          unit_price: 7500,
          discount_amount: 500,
        },
      ],
    });

  assert.equal(response.status, 201);

  response = await request(app)
    .post("/api/sales-orders")
    .set("Authorization", authorization)
    .send({
      so_number: testData.secondSoNumber,
      customer_id: customerId,
      order_date: today,
      requested_delivery_date:
        requestedDeliveryDate,
      notes: `Second sales order ${suffix}`,
      items: [
        {
          product_id: productId,
          quantity: 3,
          unit_price: 8000,
          discount_amount: 1000,
        },
      ],
    });

  assert.equal(response.status, 201);

  const secondSalesOrderId =
    response.body.data.id;

  response = await request(app)
    .patch(
      `/api/sales-orders/${secondSalesOrderId}/status`,
    )
    .set("Authorization", authorization)
    .send({ status: "CONFIRMED" });

  assert.equal(response.status, 200);
});

after(async () => {
  try {
    const salesOrderNumbers = [
      testData.firstSoNumber,
      testData.secondSoNumber,
    ];

    await pool.query(
      `
      DELETE FROM app.sales_order_items
      WHERE sales_order_id IN (
        SELECT id
        FROM app.sales_orders
        WHERE so_number = ANY($1::VARCHAR[])
      )
      `,
      [salesOrderNumbers],
    );

    await pool.query(
      `
      DELETE FROM app.sales_orders
      WHERE so_number = ANY($1::VARCHAR[])
      `,
      [salesOrderNumbers],
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
      DELETE FROM app.customers
      WHERE customer_code = $1
      `,
      [testData.customerCode],
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
  "sales order list supports search, status, customer, date range, and pagination",
  async () => {
    const commonSearch = suffix;

    let response = await request(app)
      .get("/api/sales-orders")
      .query({
        search: commonSearch,
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
      .get("/api/sales-orders")
      .query({
        search: commonSearch,
        page: 2,
        limit: 1,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.pagination.page, 2);
    assert.equal(response.body.pagination.total, 2);

    response = await request(app)
      .get("/api/sales-orders")
      .query({
        search: testData.secondSoNumber,
        status: "confirmed",
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(
      response.body.data[0].so_number,
      testData.secondSoNumber,
    );
    assert.equal(
      response.body.data[0].status,
      "CONFIRMED",
    );
    assert.equal(
      Number(response.body.data[0].total_items),
      1,
    );
    assert.equal(
      Number(response.body.data[0].total_amount),
      23000,
    );

    response = await request(app)
      .get("/api/sales-orders")
      .query({
        search: testData.customerCode,
        status: "DRAFT",
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(
      response.body.data[0].so_number,
      testData.firstSoNumber,
    );

    response = await request(app)
      .get("/api/sales-orders")
      .query({
        customer_id: customerId,
        date_from: today,
        date_to: today,
        page: 1,
        limit: 10,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 2);
    assert.equal(response.body.pagination.total, 2);

    response = await request(app)
      .get("/api/sales-orders")
      .query({
        date_from: "2026-02-30",
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "date_from must be a valid date in YYYY-MM-DD format",
    );

    response = await request(app)
      .get("/api/sales-orders")
      .query({
        date_from: "2026-08-25",
        date_to: "2026-08-24",
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "date_from cannot be later than date_to",
    );

    response = await request(app)
      .get("/api/sales-orders")
      .query({
        status: "INVALID",
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Invalid sales order status",
    );

    response = await request(app)
      .get("/api/sales-orders")
      .query({
        page: 0,
        limit: 10,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Invalid pagination parameters",
    );

    response = await request(app)
      .get("/api/sales-orders")
      .query({
        customer_id: "invalid-id",
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Invalid customer ID",
    );
  },
);