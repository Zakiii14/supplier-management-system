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

const testData = {
  adminUsername: "report_admin",
  salesUsername: "report_sales",
  financeUsername: "report_finance",
  supplierCode: "RPT-SUP",
  categoryCode: "RPT-CAT",
  productSku: "RPT-SKU",
  customerCode: "RPT-CUS",
  purchaseOrderNumber: "RPT-PO-0001",
  salesOrderNumber: "RPT-SO-0001",
  deliveryNumber: "RPT-DEL-0001",
  invoiceNumber: "RPT-INV-0001",
  paymentNumber: "RPT-PAY-0001",
};

const testPassword =
  `Reports-${randomBytes(16).toString("hex")}`;

const login = (identifier) =>
  request(app)
    .post("/api/auth/login")
    .send({
      identifier,
      password: testPassword,
    });

const cleanupTestData = async () => {
  await pool.query(
    `
    DELETE FROM app.payments
    WHERE payment_number = $1
    `,
    [testData.paymentNumber],
  );

  await pool.query(
    `
    DELETE FROM app.invoices
    WHERE invoice_number = $1
    `,
    [testData.invoiceNumber],
  );

  await pool.query(
    `
    DELETE FROM app.delivery_items
    WHERE delivery_id IN (
      SELECT id
      FROM app.deliveries
      WHERE delivery_number = $1
    )
    `,
    [testData.deliveryNumber],
  );

  await pool.query(
    `
    DELETE FROM app.deliveries
    WHERE delivery_number = $1
    `,
    [testData.deliveryNumber],
  );

  await pool.query(
    `
    DELETE FROM app.sales_order_items
    WHERE sales_order_id IN (
      SELECT id
      FROM app.sales_orders
      WHERE so_number = $1
    )
    `,
    [testData.salesOrderNumber],
  );

  await pool.query(
    `
    DELETE FROM app.sales_orders
    WHERE so_number = $1
    `,
    [testData.salesOrderNumber],
  );

  await pool.query(
    `
    DELETE FROM app.inventory_movements
    WHERE product_id IN (
      SELECT id
      FROM app.products
      WHERE sku = $1
    )
    `,
    [testData.productSku],
  );

  await pool.query(
    `
    DELETE FROM app.purchase_order_items
    WHERE purchase_order_id IN (
      SELECT id
      FROM app.purchase_orders
      WHERE po_number = $1
    )
    `,
    [testData.purchaseOrderNumber],
  );

  await pool.query(
    `
    DELETE FROM app.purchase_orders
    WHERE po_number = $1
    `,
    [testData.purchaseOrderNumber],
  );

  await pool.query(
    `
    DELETE FROM app.products
    WHERE sku = $1
    `,
    [testData.productSku],
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
    WHERE username = ANY($1::VARCHAR[])
    `,
    [[
      testData.adminUsername,
      testData.salesUsername,
      testData.financeUsername,
    ]],
  );
};

before(async () => {
  await cleanupTestData();

  const passwordHash = await bcrypt.hash(
    testPassword,
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
    VALUES
      (
        $1,
        'Report Administrator',
        'report.admin@local.test',
        $4,
        'ADMIN',
        'ACTIVE'
      ),
      (
        $2,
        'Report Sales',
        'report.sales@local.test',
        $4,
        'SALES',
        'ACTIVE'
      ),
      (
        $3,
        'Report Finance',
        'report.finance@local.test',
        $4,
        'FINANCE',
        'ACTIVE'
      )
    RETURNING id, username
    `,
    [
      testData.adminUsername,
      testData.salesUsername,
      testData.financeUsername,
      passwordHash,
    ],
  );

  const adminId = userResult.rows.find(
    (user) =>
      user.username === testData.adminUsername,
  ).id;

  const supplierResult = await pool.query(
    `
    INSERT INTO app.suppliers (
      supplier_code,
      supplier_name,
      status
    )
    VALUES ($1, 'Report Supplier', 'ACTIVE')
    RETURNING id
    `,
    [testData.supplierCode],
  );

  const supplierId = supplierResult.rows[0].id;

  const categoryResult = await pool.query(
    `
    INSERT INTO app.categories (
      category_code,
      category_name,
      status
    )
    VALUES ($1, 'Report Category', 'ACTIVE')
    RETURNING id
    `,
    [testData.categoryCode],
  );

  const categoryId = categoryResult.rows[0].id;

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
      current_stock,
      status
    )
    VALUES (
      $1,
      'Report Product',
      $2,
      $3,
      'PCS',
      10000,
      15000,
      10,
      6,
      'ACTIVE'
    )
    RETURNING id
    `,
    [
      testData.productSku,
      categoryId,
      supplierId,
    ],
  );

  const productId = productResult.rows[0].id;

  const purchaseOrderResult = await pool.query(
    `
    INSERT INTO app.purchase_orders (
      po_number,
      supplier_id,
      order_date,
      expected_date,
      status,
      created_by
    )
    VALUES (
      $1,
      $2,
      CURRENT_DATE - 10,
      CURRENT_DATE - 3,
      'PARTIALLY_RECEIVED',
      $3
    )
    RETURNING id
    `,
    [
      testData.purchaseOrderNumber,
      supplierId,
      adminId,
    ],
  );

  await pool.query(
    `
    INSERT INTO app.purchase_order_items (
      purchase_order_id,
      product_id,
      quantity,
      unit_price,
      received_quantity
    )
    VALUES ($1, $2, 10, 10000, 4)
    `,
    [purchaseOrderResult.rows[0].id, productId],
  );

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
    VALUES
      (
        $1,
        'PURCHASE_RECEIPT',
        10,
        'REPORT_TEST',
        $2,
        NOW() - INTERVAL '8 days',
        'Report inbound movement',
        $3
      ),
      (
        $1,
        'SALES_ISSUE',
        4,
        'REPORT_TEST',
        NULL,
        NOW() - INTERVAL '2 days',
        'Report outbound movement',
        $3
      )
    `,
    [
      productId,
      purchaseOrderResult.rows[0].id,
      adminId,
    ],
  );

  const customerResult = await pool.query(
    `
    INSERT INTO app.customers (
      customer_code,
      customer_name,
      status
    )
    VALUES ($1, 'Report Customer', 'ACTIVE')
    RETURNING id
    `,
    [testData.customerCode],
  );

  const customerId = customerResult.rows[0].id;

  const salesOrderResult = await pool.query(
    `
    INSERT INTO app.sales_orders (
      so_number,
      customer_id,
      order_date,
      requested_delivery_date,
      status,
      created_by
    )
    VALUES (
      $1,
      $2,
      CURRENT_DATE - 7,
      CURRENT_DATE - 2,
      'DELIVERED',
      $3
    )
    RETURNING id
    `,
    [
      testData.salesOrderNumber,
      customerId,
      adminId,
    ],
  );

  const salesOrderItemResult = await pool.query(
    `
    INSERT INTO app.sales_order_items (
      sales_order_id,
      product_id,
      quantity,
      unit_price,
      discount_amount
    )
    VALUES ($1, $2, 4, 15000, 0)
    RETURNING id
    `,
    [salesOrderResult.rows[0].id, productId],
  );

  const deliveryResult = await pool.query(
    `
    INSERT INTO app.deliveries (
      delivery_number,
      sales_order_id,
      delivery_date,
      status,
      delivered_at,
      created_by
    )
    VALUES (
      $1,
      $2,
      CURRENT_DATE - 2,
      'DELIVERED',
      NOW() - INTERVAL '2 days',
      $3
    )
    RETURNING id
    `,
    [
      testData.deliveryNumber,
      salesOrderResult.rows[0].id,
      adminId,
    ],
  );

  await pool.query(
    `
    INSERT INTO app.delivery_items (
      delivery_id,
      sales_order_item_id,
      product_id,
      quantity_delivered
    )
    VALUES ($1, $2, $3, 4)
    `,
    [
      deliveryResult.rows[0].id,
      salesOrderItemResult.rows[0].id,
      productId,
    ],
  );

  const invoiceResult = await pool.query(
    `
    INSERT INTO app.invoices (
      invoice_number,
      sales_order_id,
      customer_id,
      invoice_date,
      due_date,
      subtotal,
      discount_amount,
      tax_amount,
      grand_total,
      paid_amount,
      status
    )
    VALUES (
      $1,
      $2,
      $3,
      CURRENT_DATE - 7,
      CURRENT_DATE - 1,
      60000,
      0,
      0,
      60000,
      20000,
      'PARTIAL'
    )
    RETURNING id
    `,
    [
      testData.invoiceNumber,
      salesOrderResult.rows[0].id,
      customerId,
    ],
  );

  await pool.query(
    `
    INSERT INTO app.payments (
      payment_number,
      invoice_id,
      payment_date,
      amount,
      method,
      reference_number,
      received_by
    )
    VALUES (
      $1,
      $2,
      CURRENT_DATE - 3,
      20000,
      'BANK_TRANSFER',
      'REPORT-REFERENCE',
      $3
    )
    `,
    [
      testData.paymentNumber,
      invoiceResult.rows[0].id,
      adminId,
    ],
  );
});

after(async () => {
  await cleanupTestData();
  await pool.end();
});

const getAuthorization = async (username) => {
  const response = await login(username);

  assert.equal(response.status, 200);

  return `Bearer ${response.body.data.access_token}`;
};

const assertNumericAtLeast = (value, expected) => {
  const numericValue = Number(value);

  assert.equal(Number.isFinite(numericValue), true);
  assert.equal(numericValue >= expected, true);
};

const assertReportEnvelope = (response) => {
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(
    Number.isNaN(
      Date.parse(response.body.data.generated_at),
    ),
    false,
  );
  assert.equal(
    Array.isArray(response.body.data.trend),
    true,
  );
  assert.equal(
    Array.isArray(response.body.data.rows),
    true,
  );
  assert.equal(response.body.pagination.page, 1);
  assert.equal(response.body.pagination.limit, 10);
};

test(
  "reports provide filtered aggregates, trends, pagination, validation, and RBAC",
  async () => {
    let response = await request(app).get(
      "/api/reports/purchasing",
    );

    assert.equal(response.status, 401);

    const adminAuthorization =
      await getAuthorization(
        testData.adminUsername,
      );

    response = await request(app)
      .get("/api/reports/purchasing")
      .query({
        search: testData.purchaseOrderNumber,
        status: "PARTIALLY_RECEIVED",
        date_from: "2000-01-01",
        date_to: "2100-01-01",
        page: 1,
        limit: 10,
      })
      .set("Authorization", adminAuthorization);

    assertReportEnvelope(response);
    assert.equal(
      response.body.message,
      "Purchasing report retrieved successfully",
    );
    assert.equal(
      response.body.data.rows.some(
        (row) =>
          row.po_number ===
          testData.purchaseOrderNumber,
      ),
      true,
    );
    assertNumericAtLeast(
      response.body.data.summary
        .total_purchase_value,
      100000,
    );
    assertNumericAtLeast(
      response.body.data.summary
        .pending_receipt_quantity,
      6,
    );

    response = await request(app)
      .get("/api/reports/inventory")
      .query({
        search: testData.productSku,
        stock_status: "LOW",
        date_from: "2000-01-01",
        date_to: "2100-01-01",
        page: 1,
        limit: 10,
      })
      .set("Authorization", adminAuthorization);

    assertReportEnvelope(response);
    assert.equal(
      response.body.message,
      "Inventory report retrieved successfully",
    );

    const inventoryRow =
      response.body.data.rows.find(
        (row) => row.sku === testData.productSku,
      );

    assert.ok(inventoryRow);
    assert.equal(inventoryRow.stock_status, "LOW");
    assertNumericAtLeast(
      inventoryRow.inbound_quantity,
      10,
    );
    assertNumericAtLeast(
      inventoryRow.outbound_quantity,
      4,
    );

    response = await request(app)
      .get("/api/reports/sales")
      .query({
        search: testData.salesOrderNumber,
        status: "DELIVERED",
        date_from: "2000-01-01",
        date_to: "2100-01-01",
        page: 1,
        limit: 10,
      })
      .set("Authorization", adminAuthorization);

    assertReportEnvelope(response);
    assert.equal(
      response.body.message,
      "Sales report retrieved successfully",
    );

    const salesRow = response.body.data.rows.find(
      (row) =>
        row.so_number === testData.salesOrderNumber,
    );

    assert.ok(salesRow);
    assert.equal(Number(salesRow.delivered_quantity), 4);
    assert.equal(
      Number(salesRow.pending_delivery_quantity),
      0,
    );
    assertNumericAtLeast(
      response.body.data.summary.total_sales_value,
      60000,
    );

    response = await request(app)
      .get("/api/reports/finance")
      .query({
        search: testData.invoiceNumber,
        status: "OVERDUE",
        date_from: "2000-01-01",
        date_to: "2100-01-01",
        page: 1,
        limit: 10,
      })
      .set("Authorization", adminAuthorization);

    assertReportEnvelope(response);
    assert.equal(
      response.body.message,
      "Finance report retrieved successfully",
    );

    const financeRow =
      response.body.data.rows.find(
        (row) =>
          row.invoice_number ===
          testData.invoiceNumber,
      );

    assert.ok(financeRow);
    assert.equal(financeRow.status, "OVERDUE");
    assert.equal(
      Number(financeRow.outstanding_amount),
      40000,
    );
    assertNumericAtLeast(
      response.body.data.summary.payments_received,
      20000,
    );

    response = await request(app)
      .get("/api/reports/purchasing")
      .query({
        date_from: "2026-12-31",
        date_to: "2026-01-01",
      })
      .set("Authorization", adminAuthorization);

    assert.equal(response.status, 400);

    response = await request(app)
      .get("/api/reports/sales")
      .query({ limit: 101 })
      .set("Authorization", adminAuthorization);

    assert.equal(response.status, 400);

    const salesAuthorization =
      await getAuthorization(
        testData.salesUsername,
      );

    response = await request(app)
      .get("/api/reports/sales")
      .set("Authorization", salesAuthorization);

    assert.equal(response.status, 200);

    for (const reportPath of [
      "purchasing",
      "inventory",
      "finance",
    ]) {
      response = await request(app)
        .get(`/api/reports/${reportPath}`)
        .set("Authorization", salesAuthorization);

      assert.equal(response.status, 403);
    }

    const financeAuthorization =
      await getAuthorization(
        testData.financeUsername,
      );

    response = await request(app)
      .get("/api/reports/finance")
      .set("Authorization", financeAuthorization);

    assert.equal(response.status, 200);
  },
);
