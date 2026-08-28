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
  username:
    `invoice_admin_${suffix.toLowerCase()}`,
  email:
    `invoice.${suffix.toLowerCase()}@local.test`,
  customerCode: `INV-CUS-${suffix}`,
  firstSoNumber: `INV-SO-A-${suffix}`,
  secondSoNumber: `INV-SO-B-${suffix}`,
  thirdSoNumber: `INV-SO-C-${suffix}`,
  firstInvoiceNumber: `INV-LIST-A-${suffix}`,
  secondInvoiceNumber: `INV-LIST-B-${suffix}`,
};

const password =
  `Invoice-${randomBytes(16).toString("hex")}`;

const createDateValue = (dayOffset) => {
  const date = new Date();

  date.setUTCDate(
    date.getUTCDate() + dayOffset,
  );

  return date.toISOString().slice(0, 10);
};

const yesterday = createDateValue(-1);
const today = createDateValue(0);
const tomorrow = createDateValue(1);

let authorization;
let adminId;
let customerId;
let firstInvoiceId;
let secondInvoiceId;

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
      'Invoice Test Admin',
      $2,
      $3,
      'ADMIN',
      'ACTIVE'
    )
    RETURNING id
    `,
    [
      testData.username,
      testData.email,
      passwordHash,
    ],
  );

  adminId = userResult.rows[0].id;

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
    .post("/api/customers")
    .set("Authorization", authorization)
    .send({
      customer_code: testData.customerCode,
      customer_name:
        `Invoice Customer ${suffix}`,
      payment_terms_days: 14,
      credit_limit: 10000000,
    });

  assert.equal(response.status, 201);

  customerId = response.body.data.id;

  const salesOrderResult = await pool.query(
    `
    INSERT INTO app.sales_orders (
      so_number,
      customer_id,
      order_date,
      requested_delivery_date,
      status,
      notes,
      created_by
    )
    VALUES
      (
        $1,
        $3,
        $4,
        $4,
        'DELIVERED',
        $5,
        $6
      ),
      (
        $2,
        $3,
        $4,
        $4,
        'DELIVERED',
        $5,
        $6
      )
    RETURNING id, so_number
    `,
    [
      testData.firstSoNumber,
      testData.secondSoNumber,
      customerId,
      today,
      `Invoice sales order ${suffix}`,
      adminId,
    ],
  );

    await pool.query(
    `
    INSERT INTO app.sales_orders (
      so_number,
      customer_id,
      order_date,
      requested_delivery_date,
      status,
      notes,
      created_by
    )
    VALUES (
      $1,
      $2,
      $3,
      $3,
      'DELIVERED',
      $4,
      $5
    )
    `,
    [
      testData.thirdSoNumber,
      customerId,
      today,
      `Eligible invoice order ${suffix}`,
      adminId,
    ],
  );

  const firstSalesOrder =
    salesOrderResult.rows.find(
      (salesOrder) =>
        salesOrder.so_number ===
        testData.firstSoNumber,
    );

  const secondSalesOrder =
    salesOrderResult.rows.find(
      (salesOrder) =>
        salesOrder.so_number ===
        testData.secondSoNumber,
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
      notes
    )
    VALUES
      (
        $1,
        $3,
        $5,
        $6,
        $7,
        100000,
        0,
        0,
        100000,
        0,
        'UNPAID',
        $9
      ),
      (
        $2,
        $4,
        $5,
        $6,
        $8,
        200000,
        0,
        0,
        200000,
        0,
        'UNPAID',
        $9
      )
    RETURNING id, invoice_number
    `,
    [
      testData.firstInvoiceNumber,
      testData.secondInvoiceNumber,
      firstSalesOrder.id,
      secondSalesOrder.id,
      customerId,
      today,
      tomorrow,
      yesterday,
      `Invoice list test ${suffix}`,
    ],
  );

  firstInvoiceId =
    invoiceResult.rows.find(
      (invoice) =>
        invoice.invoice_number ===
        testData.firstInvoiceNumber,
    ).id;

  secondInvoiceId =
    invoiceResult.rows.find(
      (invoice) =>
        invoice.invoice_number ===
        testData.secondInvoiceNumber,
    ).id;
});

after(async () => {
  try {
    const invoiceNumbers = [
      testData.firstInvoiceNumber,
      testData.secondInvoiceNumber,
    ];

    const salesOrderNumbers = [
      testData.firstSoNumber,
      testData.secondSoNumber,
      testData.thirdSoNumber,
    ];

    await pool.query(
      `
      DELETE FROM app.invoices
      WHERE invoice_number =
        ANY($1::VARCHAR[])
      `,
      [invoiceNumbers],
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
  "invoice list supports search, effective status, customer, date range, and pagination",
  async () => {
    let response = await request(app)
      .get("/api/invoices")
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
      .get("/api/invoices")
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
      .get("/api/invoices")
      .query({
        search: testData.firstInvoiceNumber,
        status: "unpaid",
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(
      response.body.data[0].invoice_number,
      testData.firstInvoiceNumber,
    );
    assert.equal(
      response.body.data[0].status,
      "UNPAID",
    );
    assert.equal(
      response.body.data[0].is_overdue,
      false,
    );
    assert.equal(
      Number(
        response.body.data[0]
          .outstanding_amount,
      ),
      100000,
    );

    response = await request(app)
      .get("/api/invoices")
      .query({
        search: testData.secondInvoiceNumber,
        status: "overdue",
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(
      response.body.data[0].invoice_number,
      testData.secondInvoiceNumber,
    );
    assert.equal(
      response.body.data[0].status,
      "OVERDUE",
    );
    assert.equal(
      response.body.data[0].is_overdue,
      true,
    );
    assert.equal(
      Number(
        response.body.data[0]
          .outstanding_amount,
      ),
      200000,
    );

    response = await request(app)
      .get("/api/invoices")
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
      .get(`/api/invoices/${firstInvoiceId}`)
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(
      response.body.data.invoice_number,
      testData.firstInvoiceNumber,
    );

    assert.equal(
      response.body.data.status,
      "UNPAID",
    );

    assert.deepEqual(
      response.body.data.items,
      [],
    );

    assert.deepEqual(
      response.body.data.payments,
      [],
    );

    response = await request(app)
      .get(`/api/invoices/${secondInvoiceId}`)
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(
      response.body.data.is_overdue,
      true,
    );

    assert.equal(
      response.body.data.status,
      "OVERDUE",
    );

        response = await request(app)
      .get(
        "/api/invoices/eligible-sales-orders",
      )
      .set("Authorization", authorization);

    assert.equal(response.status, 200);

    const eligibleSalesOrder =
      response.body.data.find(
        (salesOrder) =>
          salesOrder.so_number ===
          testData.thirdSoNumber,
      );

    assert.ok(eligibleSalesOrder);

    assert.equal(
      eligibleSalesOrder.customer_id,
      customerId,
    );

    assert.equal(
      Number(eligibleSalesOrder.total_amount),
      0,
    );

    assert.equal(
      response.body.data.some(
        (salesOrder) =>
          salesOrder.so_number ===
            testData.firstSoNumber ||
          salesOrder.so_number ===
            testData.secondSoNumber,
      ),
      false,
    );

    response = await request(app)
      .get("/api/invoices")
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
      .get("/api/invoices")
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
      .get("/api/invoices")
      .query({
        status: "INVALID",
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Invalid invoice status",
    );

    response = await request(app)
      .get("/api/invoices")
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
      .get("/api/invoices")
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