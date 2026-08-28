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
  username: `delivery_admin_${suffix.toLowerCase()}`,
  email:
    `delivery.${suffix.toLowerCase()}@local.test`,
  supplierCode: `DEL-SUP-${suffix}`,
  categoryCode: `DEL-CAT-${suffix}`,
  sku: `DEL-SKU-${suffix}`,
  customerCode: `DEL-CUS-${suffix}`,
  firstSoNumber: `DEL-SO-A-${suffix}`,
  secondSoNumber: `DEL-SO-B-${suffix}`,
  firstDeliveryNumber: `DEL-LIST-A-${suffix}`,
  secondDeliveryNumber: `DEL-LIST-B-${suffix}`,
};

const password =
  `Delivery-${randomBytes(16).toString("hex")}`;

const today = new Date()
  .toISOString()
  .slice(0, 10);

let authorization;
let firstSalesOrderId;
let secondSalesOrderId;

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
      'Delivery Test Admin',
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
        `Delivery Supplier ${suffix}`,
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
        `Delivery Category ${suffix}`,
    });

  assert.equal(response.status, 201);

  const categoryId = response.body.data.id;

  response = await request(app)
    .post("/api/products")
    .set("Authorization", authorization)
    .send({
      sku: testData.sku,
      product_name:
        `Delivery Product ${suffix}`,
      category_id: categoryId,
      supplier_id: supplierId,
      unit: "PCS",
      purchase_price: 5000,
      selling_price: 8000,
      minimum_stock: 2,
    });

  assert.equal(response.status, 201);

  const productId = response.body.data.id;

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
        `Delivery Customer ${suffix}`,
      payment_terms_days: 14,
      credit_limit: 10000000,
    });

  assert.equal(response.status, 201);

  const customerId = response.body.data.id;

  response = await request(app)
    .post("/api/sales-orders")
    .set("Authorization", authorization)
    .send({
      so_number: testData.firstSoNumber,
      customer_id: customerId,
      order_date: today,
      requested_delivery_date: today,
      notes: `First delivery order ${suffix}`,
      items: [
        {
          product_id: productId,
          quantity: 5,
          unit_price: 8000,
          discount_amount: 0,
        },
      ],
    });

  assert.equal(response.status, 201);

  firstSalesOrderId = response.body.data.id;

  const firstSalesOrderItemId =
    response.body.data.items[0].id;

  response = await request(app)
    .patch(
      `/api/sales-orders/${firstSalesOrderId}/status`,
    )
    .set("Authorization", authorization)
    .send({ status: "CONFIRMED" });

  assert.equal(response.status, 200);

  response = await request(app)
    .post("/api/sales-orders")
    .set("Authorization", authorization)
    .send({
      so_number: testData.secondSoNumber,
      customer_id: customerId,
      order_date: today,
      requested_delivery_date: today,
      notes: `Second delivery order ${suffix}`,
      items: [
        {
          product_id: productId,
          quantity: 3,
          unit_price: 8000,
          discount_amount: 0,
        },
      ],
    });

  assert.equal(response.status, 201);

  secondSalesOrderId = response.body.data.id;

  const secondSalesOrderItemId =
    response.body.data.items[0].id;

  response = await request(app)
    .patch(
      `/api/sales-orders/${secondSalesOrderId}/status`,
    )
    .set("Authorization", authorization)
    .send({ status: "CONFIRMED" });

  assert.equal(response.status, 200);

  response = await request(app)
    .post("/api/deliveries")
    .set("Authorization", authorization)
    .send({
      delivery_number:
        testData.firstDeliveryNumber,
      sales_order_id: firstSalesOrderId,
      delivery_date: today,
      recipient_name:
        `First Recipient ${suffix}`,
      address: "First Delivery Address",
      notes: `First delivery ${suffix}`,
      items: [
        {
          sales_order_item_id:
            firstSalesOrderItemId,
          quantity_delivered: 2,
        },
      ],
    });

  assert.equal(response.status, 201);

  response = await request(app)
    .post("/api/deliveries")
    .set("Authorization", authorization)
    .send({
      delivery_number:
        testData.secondDeliveryNumber,
      sales_order_id: secondSalesOrderId,
      delivery_date: today,
      recipient_name:
        `Second Recipient ${suffix}`,
      address: "Second Delivery Address",
      notes: `Second delivery ${suffix}`,
      items: [
        {
          sales_order_item_id:
            secondSalesOrderItemId,
          quantity_delivered: 3,
        },
      ],
    });

  assert.equal(response.status, 201);

  const secondDeliveryId =
    response.body.data.id;

  response = await request(app)
    .patch(
      `/api/deliveries/${secondDeliveryId}/status`,
    )
    .set("Authorization", authorization)
    .send({ status: "SHIPPED" });

  assert.equal(response.status, 200);
});

after(async () => {
  try {
    const deliveryNumbers = [
      testData.firstDeliveryNumber,
      testData.secondDeliveryNumber,
    ];

    const salesOrderNumbers = [
      testData.firstSoNumber,
      testData.secondSoNumber,
    ];

    await pool.query(
      `
      DELETE FROM app.inventory_movements
      WHERE reference_type = 'DELIVERY'
        AND reference_id IN (
          SELECT id
          FROM app.deliveries
          WHERE delivery_number =
            ANY($1::VARCHAR[])
        )
      `,
      [deliveryNumbers],
    );

    await pool.query(
      `
      DELETE FROM app.delivery_items
      WHERE delivery_id IN (
        SELECT id
        FROM app.deliveries
        WHERE delivery_number =
          ANY($1::VARCHAR[])
      )
      `,
      [deliveryNumbers],
    );

    await pool.query(
      `
      DELETE FROM app.deliveries
      WHERE delivery_number =
        ANY($1::VARCHAR[])
      `,
      [deliveryNumbers],
    );

    await pool.query(
      `
      DELETE FROM app.sales_order_items
      WHERE sales_order_id IN (
        SELECT id
        FROM app.sales_orders
        WHERE so_number =
          ANY($1::VARCHAR[])
      )
      `,
      [salesOrderNumbers],
    );

    await pool.query(
      `
      DELETE FROM app.sales_orders
      WHERE so_number =
        ANY($1::VARCHAR[])
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
  "delivery list supports search, status, sales order, date range, and pagination",
  async () => {
    let response = await request(app)
      .get("/api/deliveries")
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
      .get("/api/deliveries")
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
      .get("/api/deliveries")
      .query({
        search: testData.secondDeliveryNumber,
        status: "shipped",
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(
      response.body.data[0].delivery_number,
      testData.secondDeliveryNumber,
    );
    assert.equal(
      response.body.data[0].status,
      "SHIPPED",
    );
    assert.equal(
      Number(response.body.data[0].total_items),
      1,
    );
    assert.equal(
      Number(
        response.body.data[0].total_quantity,
      ),
      3,
    );

    response = await request(app)
      .get("/api/deliveries")
      .query({
        sales_order_id: firstSalesOrderId,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(
      response.body.data[0].delivery_number,
      testData.firstDeliveryNumber,
    );

    const salesOrderDetailResponse =
      await request(app)
        .get(
          `/api/sales-orders/${firstSalesOrderId}`,
        )
        .set("Authorization", authorization);

    assert.equal(
      salesOrderDetailResponse.status,
      200,
    );

    assert.equal(
      salesOrderDetailResponse.body.data.items.length,
      1,
    );

    const firstSalesOrderItem =
      salesOrderDetailResponse.body.data.items[0];

    assert.equal(
      Number(firstSalesOrderItem.quantity),
      5,
    );

    assert.equal(
      Number(
        firstSalesOrderItem.reserved_quantity,
      ),
      2,
    );

    assert.equal(
      Number(
        firstSalesOrderItem.remaining_quantity,
      ),
      3,
    );

    assert.equal(
      firstSalesOrderItem.product_status,
      "ACTIVE",
    );

    response = await request(app)
      .get("/api/deliveries")
      .query({
        search: suffix,
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
      .get("/api/deliveries")
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
      .get("/api/deliveries")
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
      .get("/api/deliveries")
      .query({
        status: "INVALID",
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Invalid delivery status",
    );

    response = await request(app)
      .get("/api/deliveries")
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
      .get("/api/deliveries")
      .query({
        sales_order_id: "invalid-id",
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Invalid sales order ID",
    );
  },
);