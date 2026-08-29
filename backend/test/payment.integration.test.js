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
    `payment_admin_${suffix.toLowerCase()}`,
  adminEmail:
    `payment.admin.${suffix.toLowerCase()}@local.test`,
  salesUsername:
    `payment_sales_${suffix.toLowerCase()}`,
  salesEmail:
    `payment.sales.${suffix.toLowerCase()}@local.test`,
  customerCode: `PAY-CUS-${suffix}`,
  firstSoNumber: `PAY-SO-A-${suffix}`,
  secondSoNumber: `PAY-SO-B-${suffix}`,
  thirdSoNumber: `PAY-SO-C-${suffix}`,
  firstInvoiceNumber: `PAY-INV-A-${suffix}`,
  secondInvoiceNumber: `PAY-INV-B-${suffix}`,
  thirdInvoiceNumber: `PAY-INV-C-${suffix}`,
  existingBankPaymentNumber:
    `PAY-LIST-A-${suffix}`,
  existingCashPaymentNumber:
    `PAY-LIST-B-${suffix}`,
  partialPaymentNumber:
    `PAY-NEW-A-${suffix}`,
  finalPaymentNumber:
    `PAY-NEW-B-${suffix}`,
  overpaymentNumber:
    `PAY-OVER-${suffix}`,
  invalidDatePaymentNumber:
    `PAY-DATE-${suffix}`,
};

const password =
  `Payment-${randomBytes(16).toString("hex")}`;

const createDateValue = (dayOffset) => {
  const date = new Date();

  date.setUTCDate(
    date.getUTCDate() + dayOffset,
  );

  return date.toISOString().slice(0, 10);
};

const twoDaysAgo = createDateValue(-2);
const yesterday = createDateValue(-1);
const today = createDateValue(0);
const tomorrow = createDateValue(1);

let adminAuthorization;
let salesAuthorization;
let adminId;
let salesId;
let customerId;
let firstInvoiceId;
let secondInvoiceId;
let thirdInvoiceId;
let existingBankPaymentId;

before(async () => {
  const passwordHash = await bcrypt.hash(
    password,
    8,
  );

  const usersResult = await pool.query(
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
        'Payment Test Admin',
        $2,
        $5,
        'ADMIN',
        'ACTIVE'
      ),
      (
        $3,
        'Payment Test Sales',
        $4,
        $5,
        'SALES',
        'ACTIVE'
      )
    RETURNING id, username
    `,
    [
      testData.adminUsername,
      testData.adminEmail,
      testData.salesUsername,
      testData.salesEmail,
      passwordHash,
    ],
  );

  adminId = usersResult.rows.find(
    (user) =>
      user.username === testData.adminUsername,
  ).id;

  salesId = usersResult.rows.find(
    (user) =>
      user.username === testData.salesUsername,
  ).id;

  let response = await request(app)
    .post("/api/auth/login")
    .send({
      identifier: testData.adminUsername,
      password,
    });

  assert.equal(response.status, 200);

  adminAuthorization =
    `Bearer ${response.body.data.access_token}`;

  response = await request(app)
    .post("/api/auth/login")
    .send({
      identifier: testData.salesUsername,
      password,
    });

  assert.equal(response.status, 200);

  salesAuthorization =
    `Bearer ${response.body.data.access_token}`;

  const customerResult = await pool.query(
    `
    INSERT INTO app.customers (
      customer_code,
      customer_name,
      contact_person,
      phone,
      email,
      address,
      city,
      payment_terms_days,
      credit_limit,
      status
    )
    VALUES (
      $1,
      $2,
      'Payment Contact',
      '081234567890',
      $3,
      'Payment Test Address',
      'Banyumas',
      14,
      10000000,
      'ACTIVE'
    )
    RETURNING id
    `,
    [
      testData.customerCode,
      `Payment Customer ${suffix}`,
      `payment.customer.${suffix.toLowerCase()}@local.test`,
    ],
  );

  customerId = customerResult.rows[0].id;

  const salesOrdersResult = await pool.query(
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
        $4,
        $5,
        $5,
        'DELIVERED',
        $6,
        $7
      ),
      (
        $2,
        $4,
        $5,
        $5,
        'DELIVERED',
        $6,
        $7
      ),
      (
        $3,
        $4,
        $5,
        $5,
        'DELIVERED',
        $6,
        $7
      )
    RETURNING id, so_number
    `,
    [
      testData.firstSoNumber,
      testData.secondSoNumber,
      testData.thirdSoNumber,
      customerId,
      yesterday,
      `Payment sales order ${suffix}`,
      adminId,
    ],
  );

  const firstSalesOrderId =
    salesOrdersResult.rows.find(
      (salesOrder) =>
        salesOrder.so_number ===
        testData.firstSoNumber,
    ).id;

  const secondSalesOrderId =
    salesOrdersResult.rows.find(
      (salesOrder) =>
        salesOrder.so_number ===
        testData.secondSoNumber,
    ).id;

  const thirdSalesOrderId =
    salesOrdersResult.rows.find(
      (salesOrder) =>
        salesOrder.so_number ===
        testData.thirdSoNumber,
    ).id;

  const invoicesResult = await pool.query(
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
        $4,
        $7,
        $8,
        $10,
        100000,
        0,
        0,
        100000,
        0,
        'UNPAID',
        $11
      ),
      (
        $2,
        $5,
        $7,
        $8,
        $8,
        200000,
        0,
        0,
        200000,
        50000,
        'PARTIAL',
        $11
      ),
      (
        $3,
        $6,
        $7,
        $9,
        $10,
        300000,
        0,
        0,
        300000,
        300000,
        'PAID',
        $11
      )
    RETURNING id, invoice_number
    `,
    [
      testData.firstInvoiceNumber,
      testData.secondInvoiceNumber,
      testData.thirdInvoiceNumber,
      firstSalesOrderId,
      secondSalesOrderId,
      thirdSalesOrderId,
      customerId,
      yesterday,
      today,
      tomorrow,
      `Payment invoice ${suffix}`,
    ],
  );

  firstInvoiceId = invoicesResult.rows.find(
    (invoice) =>
      invoice.invoice_number ===
      testData.firstInvoiceNumber,
  ).id;

  secondInvoiceId = invoicesResult.rows.find(
    (invoice) =>
      invoice.invoice_number ===
      testData.secondInvoiceNumber,
  ).id;

  thirdInvoiceId = invoicesResult.rows.find(
    (invoice) =>
      invoice.invoice_number ===
      testData.thirdInvoiceNumber,
  ).id;

  const paymentsResult = await pool.query(
    `
    INSERT INTO app.payments (
      payment_number,
      invoice_id,
      payment_date,
      amount,
      method,
      reference_number,
      notes,
      received_by
    )
    VALUES
      (
        $1,
        $3,
        $5,
        50000,
        'BANK_TRANSFER',
        $7,
        $9,
        $10
      ),
      (
        $2,
        $4,
        $6,
        300000,
        'CASH',
        $8,
        $9,
        $10
      )
    RETURNING id, payment_number
    `,
    [
      testData.existingBankPaymentNumber,
      testData.existingCashPaymentNumber,
      secondInvoiceId,
      thirdInvoiceId,
      yesterday,
      today,
      `TRF-A-${suffix}`,
      `CASH-B-${suffix}`,
      `Payment list ${suffix}`,
      adminId,
    ],
  );

  existingBankPaymentId =
    paymentsResult.rows.find(
      (payment) =>
        payment.payment_number ===
        testData.existingBankPaymentNumber,
    ).id;
});

after(async () => {
  try {
    const paymentNumbers = [
      testData.existingBankPaymentNumber,
      testData.existingCashPaymentNumber,
      testData.partialPaymentNumber,
      testData.finalPaymentNumber,
      testData.overpaymentNumber,
      testData.invalidDatePaymentNumber,
    ];

    const invoiceNumbers = [
      testData.firstInvoiceNumber,
      testData.secondInvoiceNumber,
      testData.thirdInvoiceNumber,
    ];

    const salesOrderNumbers = [
      testData.firstSoNumber,
      testData.secondSoNumber,
      testData.thirdSoNumber,
    ];

    await pool.query(
      `
      DELETE FROM app.payments
      WHERE payment_number =
        ANY($1::VARCHAR[])
      `,
      [paymentNumbers],
    );

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
      WHERE id = ANY($1::UUID[])
      `,
      [[adminId, salesId]],
    );
  } finally {
    await pool.end();
  }
});

test(
  "payment list, eligible invoices, detail, creation, validation, and RBAC work correctly",
  async () => {
    let response = await request(app)
      .get("/api/payments")
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
    assert.equal(response.body.pagination.total, 2);
    assert.equal(
      response.body.pagination.total_pages,
      2,
    );

    response = await request(app)
      .get("/api/payments")
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
    assert.equal(response.body.pagination.total, 2);

    response = await request(app)
      .get("/api/payments")
      .query({
        method: "bank_transfer",
        invoice_id: secondInvoiceId,
        customer_id: customerId,
        date_from: yesterday,
        date_to: yesterday,
      })
      .set(
        "Authorization",
        adminAuthorization,
      );

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(
      response.body.data[0].payment_number,
      testData.existingBankPaymentNumber,
    );
    assert.equal(
      response.body.data[0].received_by_name,
      "Payment Test Admin",
    );
    assert.equal(
      Number(
        response.body.data[0]
          .outstanding_amount,
      ),
      150000,
    );

    response = await request(app)
      .get(
        `/api/payments/${existingBankPaymentId}`,
      )
      .set(
        "Authorization",
        adminAuthorization,
      );

    assert.equal(response.status, 200);
    assert.equal(
      response.body.data.payment_number,
      testData.existingBankPaymentNumber,
    );
    assert.equal(
      response.body.data.invoice_number,
      testData.secondInvoiceNumber,
    );
    assert.equal(
      response.body.data.invoice_status,
      "OVERDUE",
    );
    assert.equal(
      response.body.data.invoice_is_overdue,
      true,
    );
    assert.equal(
      response.body.data.received_by_name,
      "Payment Test Admin",
    );

    response = await request(app)
      .get("/api/payments/eligible-invoices")
      .set(
        "Authorization",
        adminAuthorization,
      );

    assert.equal(response.status, 200);

    const firstEligibleInvoice =
      response.body.data.find(
        (invoice) =>
          invoice.id === firstInvoiceId,
      );

    const secondEligibleInvoice =
      response.body.data.find(
        (invoice) =>
          invoice.id === secondInvoiceId,
      );

    assert.ok(firstEligibleInvoice);
    assert.ok(secondEligibleInvoice);

    assert.equal(
      firstEligibleInvoice.status,
      "UNPAID",
    );
    assert.equal(
      Number(
        firstEligibleInvoice.outstanding_amount,
      ),
      100000,
    );

    assert.equal(
      secondEligibleInvoice.status,
      "OVERDUE",
    );
    assert.equal(
      Number(
        secondEligibleInvoice.outstanding_amount,
      ),
      150000,
    );

    assert.equal(
      response.body.data.some(
        (invoice) =>
          invoice.id === thirdInvoiceId,
      ),
      false,
    );

    response = await request(app)
      .get("/api/payments")
      .set(
        "Authorization",
        salesAuthorization,
      );

    assert.equal(response.status, 403);

    response = await request(app)
      .get("/api/payments")
      .query({
        method: "INVALID",
      })
      .set(
        "Authorization",
        adminAuthorization,
      );

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Invalid payment method",
    );

    response = await request(app)
      .get("/api/payments")
      .query({
        page: 0,
        limit: 10,
      })
      .set(
        "Authorization",
        adminAuthorization,
      );

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Invalid pagination parameters",
    );

    response = await request(app)
      .get("/api/payments")
      .query({
        invoice_id: "invalid-id",
      })
      .set(
        "Authorization",
        adminAuthorization,
      );

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Invalid invoice ID",
    );

    response = await request(app)
      .get("/api/payments")
      .query({
        customer_id: "invalid-id",
      })
      .set(
        "Authorization",
        adminAuthorization,
      );

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Invalid customer ID",
    );

    response = await request(app)
      .get("/api/payments")
      .query({
        date_from: "2026-02-30",
      })
      .set(
        "Authorization",
        adminAuthorization,
      );

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "date_from must be a valid date in YYYY-MM-DD format",
    );

    response = await request(app)
      .post("/api/payments")
      .set(
        "Authorization",
        adminAuthorization,
      )
      .send({
        payment_number:
          testData.invalidDatePaymentNumber,
        invoice_id: firstInvoiceId,
        payment_date: twoDaysAgo,
        amount: 10000,
        method: "CASH",
      });

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Payment date cannot be earlier than invoice date",
    );

    response = await request(app)
      .post("/api/payments")
      .set(
        "Authorization",
        adminAuthorization,
      )
      .send({
        payment_number:
          testData.overpaymentNumber,
        invoice_id: firstInvoiceId,
        payment_date: today,
        amount: 100001,
        method: "CASH",
      });

    assert.equal(response.status, 400);
    assert.match(
      response.body.message,
      /Payment exceeds outstanding amount/,
    );

    response = await request(app)
      .post("/api/payments")
      .set(
        "Authorization",
        adminAuthorization,
      )
      .send({
        payment_number:
          testData.partialPaymentNumber.toLowerCase(),
        invoice_id: firstInvoiceId,
        payment_date: today,
        amount: 40000,
        method: "bank_transfer",
        reference_number:
          `NEW-TRF-${suffix}`,
        notes: "Partial payment test",
      });

    assert.equal(response.status, 201);
    assert.equal(
      response.body.data.payment.payment_number,
      testData.partialPaymentNumber,
    );
    assert.equal(
      response.body.data.payment.method,
      "BANK_TRANSFER",
    );
    assert.equal(
      response.body.data.invoice.status,
      "PARTIAL",
    );
    assert.equal(
      Number(
        response.body.data.invoice.paid_amount,
      ),
      40000,
    );
    assert.equal(
      Number(
        response.body.data.invoice
          .outstanding_amount,
      ),
      60000,
    );

    response = await request(app)
      .post("/api/payments")
      .set(
        "Authorization",
        adminAuthorization,
      )
      .send({
        payment_number:
          testData.partialPaymentNumber,
        invoice_id: firstInvoiceId,
        payment_date: today,
        amount: 10000,
        method: "CASH",
      });

    assert.equal(response.status, 409);
    assert.equal(
      response.body.message,
      "Payment number already exists",
    );

    response = await request(app)
      .post("/api/payments")
      .set(
        "Authorization",
        adminAuthorization,
      )
      .send({
        payment_number:
          testData.overpaymentNumber,
        invoice_id: firstInvoiceId,
        payment_date: today,
        amount: 60001,
        method: "CASH",
      });

    assert.equal(response.status, 400);
    assert.match(
      response.body.message,
      /Payment exceeds outstanding amount/,
    );

    response = await request(app)
      .post("/api/payments")
      .set(
        "Authorization",
        adminAuthorization,
      )
      .send({
        payment_number:
          testData.finalPaymentNumber,
        invoice_id: firstInvoiceId,
        payment_date: today,
        amount: 60000,
        method: "CASH",
        notes: "Final payment test",
      });

    assert.equal(response.status, 201);
    assert.equal(
      response.body.data.invoice.status,
      "PAID",
    );
    assert.equal(
      Number(
        response.body.data.invoice.paid_amount,
      ),
      100000,
    );
    assert.equal(
      Number(
        response.body.data.invoice
          .outstanding_amount,
      ),
      0,
    );

    response = await request(app)
      .get("/api/payments/eligible-invoices")
      .set(
        "Authorization",
        adminAuthorization,
      );

    assert.equal(response.status, 200);
    assert.equal(
      response.body.data.some(
        (invoice) =>
          invoice.id === firstInvoiceId,
      ),
      false,
    );
    assert.equal(
      response.body.data.some(
        (invoice) =>
          invoice.id === secondInvoiceId,
      ),
      true,
    );
  },
);
