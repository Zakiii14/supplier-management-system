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
  adminUsername: "dashboard_admin",
  salesUsername: "dashboard_sales",
  financeUsername: "dashboard_finance",
  supplierCode: "DASH-SUP",
  categoryCode: "DASH-CAT",
  productSku: "DASH-SKU",
  customerCode: "DASH-CUS",
  purchaseOrderNumber: "DASH-PO-0001",
  salesOrderNumber: "DASH-SO-0001",
  invoiceNumber: "DASH-INV-0001",
  paymentNumber: "DASH-PAY-0001",
};

const testPassword =
  `Dashboard-${randomBytes(16).toString("hex")}`;

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
    DELETE FROM app.sales_orders
    WHERE so_number = $1
    `,
    [testData.salesOrderNumber],
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
        'Dashboard Administrator',
        'dashboard.admin@local.test',
        $4,
        'ADMIN',
        'ACTIVE'
      ),
      (
        $2,
        'Dashboard Sales',
        'dashboard.sales@local.test',
        $4,
        'SALES',
        'ACTIVE'
      ),
      (
        $3,
        'Dashboard Finance',
        'dashboard.finance@local.test',
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
    VALUES ($1, $2, 'ACTIVE')
    RETURNING id
    `,
    [
      testData.supplierCode,
      "Dashboard Supplier",
    ],
  );

  const supplierId = supplierResult.rows[0].id;

  const categoryResult = await pool.query(
    `
    INSERT INTO app.categories (
      category_code,
      category_name,
      status
    )
    VALUES ($1, $2, 'ACTIVE')
    RETURNING id
    `,
    [
      testData.categoryCode,
      "Dashboard Category",
    ],
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
      $2,
      $3,
      $4,
      'PCS',
      10000,
      15000,
      1000000,
      1,
      'ACTIVE'
    )
    RETURNING id
    `,
    [
      testData.productSku,
      "Dashboard Low Stock Product",
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
      created_by,
      created_at
    )
    VALUES (
      $1,
      $2,
      CURRENT_DATE,
      CURRENT_DATE + 7,
      'SUBMITTED',
      $3,
      NOW() + INTERVAL '10 years'
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
    VALUES ($1, $2, 10, 10000, 2)
    `,
    [purchaseOrderResult.rows[0].id, productId],
  );

  const customerResult = await pool.query(
    `
    INSERT INTO app.customers (
      customer_code,
      customer_name,
      status
    )
    VALUES ($1, $2, 'ACTIVE')
    RETURNING id
    `,
    [
      testData.customerCode,
      "Dashboard Customer",
    ],
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
      created_by,
      created_at
    )
    VALUES (
      $1,
      $2,
      (
  DATE_TRUNC('month', CURRENT_DATE)
  - INTERVAL '1 month'
)::DATE,
(
  DATE_TRUNC('month', CURRENT_DATE)
  - INTERVAL '1 month'
  + INTERVAL '10 days'
)::DATE,
      'CONFIRMED',
      $3,
      NOW() + INTERVAL '10 years'
    )
    RETURNING id
    `,
    [
      testData.salesOrderNumber,
      customerId,
      adminId,
    ],
  );

  await pool.query(
    `
  INSERT INTO app.sales_order_items (
    sales_order_id,
    product_id,
    quantity,
    unit_price
  )
  VALUES ($1, $2, 10, 15000)
  `,
    [
      salesOrderResult.rows[0].id,
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
      status,
      created_at
    )
    VALUES (
      $1,
      $2,
      $3,
      (
  DATE_TRUNC('month', CURRENT_DATE)
  - INTERVAL '2 months'
)::DATE,
(
  DATE_TRUNC('month', CURRENT_DATE)
  - INTERVAL '1 month'
)::DATE,
      150000,
      0,
      0,
      150000,
      25000,
      'PARTIAL',
      NOW() + INTERVAL '10 years'
        + INTERVAL '1 day'
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
      received_by,
      created_at
    )
    VALUES (
      $1,
      $2,
      CURRENT_DATE,
      25000,
      'BANK_TRANSFER',
      'DASHBOARD-REFERENCE',
      $3,
      NOW() + INTERVAL '10 years'
        + INTERVAL '2 days'
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

const assertNonNegativeNumber = (value) => {
  const numericValue = Number(value);

  assert.equal(
    Number.isFinite(numericValue),
    true,
  );

  assert.equal(numericValue >= 0, true);
};

const assertTrendData = ({
  data,
  type,
  months,
  fields,
}) => {
  assert.equal(
    Number.isNaN(
      Date.parse(data.generated_at),
    ),
    false,
  );

  assert.equal(data.type, type);
  assert.equal(data.months, months);
  assert.equal(data.trend.length, months);

  assert.deepEqual(
    data.metrics.map((metric) => metric.field),
    fields,
  );

  const periods = data.trend.map(
    (item) => item.period,
  );

  assert.deepEqual(
    periods,
    [...periods].sort(),
  );

  for (const row of data.trend) {
    assert.match(row.period, /^\d{4}-\d{2}$/);

    assert.deepEqual(
      Object.keys(row).sort(),
      ["period", ...fields].sort(),
    );

    for (const field of fields) {
      assertNonNegativeNumber(row[field]);
    }
  }
};

test(
  "dashboard summary returns role-aware metrics, alerts, and activities",
  async () => {
    let response = await request(app).get(
      "/api/dashboard/summary",
    );

    assert.equal(response.status, 401);

    const adminAuthorization =
      await getAuthorization(
        testData.adminUsername,
      );

    response = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", adminAuthorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(
      response.body.message,
      "Dashboard summary retrieved successfully",
    );

    const adminData = response.body.data;

    assert.equal(
      Number.isNaN(
        Date.parse(adminData.generated_at),
      ),
      false,
    );

    assert.deepEqual(
      Object.keys(adminData.sections).sort(),
      [
        "administration",
        "finance",
        "inventory",
        "purchasing",
        "sales",
      ],
    );

    assert.equal(
      adminData.sections.inventory
        .low_stock_products >= 1,
      true,
    );

    assert.equal(
      adminData.sections.purchasing
        .open_purchase_orders >= 1,
      true,
    );

    assert.equal(
      Number(
        adminData.sections.purchasing
          .pending_receipt_quantity,
      ) >= 8,
      true,
    );

    assert.equal(
      adminData.sections.sales
        .open_sales_orders >= 1,
      true,
    );

    assert.equal(
      adminData.sections.finance
        .overdue_invoices >= 1,
      true,
    );

    assert.equal(
      Number(
        adminData.sections.finance
          .outstanding_amount,
      ) >= 125000,
      true,
    );

    assert.equal(
      adminData.sections.finance
        .payments_this_month >= 1,
      true,
    );

    assert.equal(
      adminData.sections.administration
        .active_users >= 3,
      true,
    );

    assertNonNegativeNumber(
      adminData.sections.inventory
        .total_stock_units,
    );

    assertNonNegativeNumber(
      adminData.sections.purchasing
        .inventory_value,
    );

    assert.equal(
      adminData.alerts.low_stock_products.some(
        (product) =>
          product.sku === testData.productSku,
      ),
      true,
    );

    assert.equal(
      adminData.alerts.overdue_invoices.some(
        (invoice) =>
          invoice.invoice_number ===
          testData.invoiceNumber,
      ),
      true,
    );

    assert.equal(
      adminData.recent_activity.length <= 8,
      true,
    );

    assert.equal(
      adminData.recent_activity.some(
        (activity) =>
          activity.reference_number ===
          testData.paymentNumber,
      ),
      true,
    );

    const salesAuthorization =
      await getAuthorization(
        testData.salesUsername,
      );

    response = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", salesAuthorization);

    assert.equal(response.status, 200);

    const salesData = response.body.data;

    assert.deepEqual(
      Object.keys(salesData.sections).sort(),
      ["inventory", "sales"],
    );

    assert.equal(
      Object.hasOwn(
        salesData.alerts,
        "overdue_invoices",
      ),
      false,
    );

    const salesActivityTypes = new Set([
      "SALES_ORDER",
      "DELIVERY",
      "INVOICE",
    ]);

    assert.equal(
      salesData.recent_activity.every(
        (activity) =>
          salesActivityTypes.has(
            activity.activity_type,
          ),
      ),
      true,
    );

    assert.equal(
      salesData.recent_activity.some(
        (activity) =>
          activity.reference_number ===
          testData.invoiceNumber,
      ),
      true,
    );

    const financeAuthorization =
      await getAuthorization(
        testData.financeUsername,
      );

    response = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", financeAuthorization);

    assert.equal(response.status, 200);

    const financeData = response.body.data;

    assert.deepEqual(
      Object.keys(financeData.sections).sort(),
      [
        "finance",
        "inventory",
        "purchasing",
        "sales",
      ],
    );

    assert.equal(
      Object.hasOwn(
        financeData.sections,
        "administration",
      ),
      false,
    );

    assert.equal(
      financeData.alerts.overdue_invoices.some(
        (invoice) =>
          invoice.invoice_number ===
          testData.invoiceNumber,
      ),
      true,
    );

    const financeActivityTypes = new Set([
      "PURCHASE_ORDER",
      "GOODS_RECEIPT",
      "INVENTORY_MOVEMENT",
      "SALES_ORDER",
      "INVOICE",
      "PAYMENT",
    ]);

    assert.equal(
      financeData.recent_activity.every(
        (activity) =>
          financeActivityTypes.has(
            activity.activity_type,
          ),
      ),
      true,
    );
  },
);

test(
  "dashboard trends return zero-filled periods, validation, and role-aware metrics",
  async () => {
    let response = await request(app).get(
      "/api/dashboard/trends",
    );

    assert.equal(response.status, 401);

    const adminAuthorization =
      await getAuthorization(
        testData.adminUsername,
      );

    response = await request(app)
      .get("/api/dashboard/trends")
      .query({ months: 3 })
      .set(
        "Authorization",
        adminAuthorization,
      );

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(
      response.body.message,
      "months must be either 6 or 12",
    );

    response = await request(app)
      .get("/api/dashboard/trends")
      .set(
        "Authorization",
        adminAuthorization,
      );

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(
      response.body.message,
      "Dashboard trends retrieved successfully",
    );

    const adminData = response.body.data;

    assertTrendData({
      data: adminData,
      type: "business",
      months: 6,
      fields: [
        "purchase_value",
        "sales_value",
      ],
    });

    assert.equal(
      adminData.trend.some(
        (item) =>
          Number(item.purchase_value) >=
          100000,
      ),
      true,
    );

    assert.equal(
      adminData.trend.some(
        (item) =>
          Number(item.sales_value) >=
          150000,
      ),
      true,
    );

    const salesAuthorization =
      await getAuthorization(
        testData.salesUsername,
      );

    response = await request(app)
      .get("/api/dashboard/trends")
      .query({ months: 12 })
      .set(
        "Authorization",
        salesAuthorization,
      );

    assert.equal(response.status, 200);

    const salesData = response.body.data;

    assertTrendData({
      data: salesData,
      type: "sales",
      months: 12,
      fields: ["sales_value"],
    });

    assert.equal(
      salesData.trend.some(
        (item) =>
          Number(item.sales_value) >=
          150000,
      ),
      true,
    );

    const financeAuthorization =
      await getAuthorization(
        testData.financeUsername,
      );

    response = await request(app)
      .get("/api/dashboard/trends")
      .set(
        "Authorization",
        financeAuthorization,
      );

    assert.equal(response.status, 200);

    const financeData = response.body.data;

    assertTrendData({
      data: financeData,
      type: "finance",
      months: 6,
      fields: [
        "invoice_value",
        "payment_value",
      ],
    });

    assert.equal(
      financeData.trend.some(
        (item) =>
          Number(item.invoice_value) >=
          150000,
      ),
      true,
    );

    assert.equal(
      financeData.trend.some(
        (item) =>
          Number(item.payment_value) >=
          25000,
      ),
      true,
    );
  },
);
