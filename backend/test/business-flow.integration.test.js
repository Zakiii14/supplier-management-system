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
    "Integration tests must use supplier_management_test"
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
  username: `e2e_admin_${suffix.toLowerCase()}`,
  email: `e2e.${suffix.toLowerCase()}@local.test`,
  supplierCode: `T-SUP-${suffix}`,
  categoryCode: `T-CAT-${suffix}`,
  sku: `T-SKU-${suffix}`,
  customerCode: `T-CUS-${suffix}`,
  poNumber: `T-PO-${suffix}`,
  receiptNumber: `T-GR-${suffix}`,
  soNumber: `T-SO-${suffix}`,
  deliveryNumber: `T-DEL-${suffix}`,
  invoiceNumber: `T-INV-${suffix}`,
  paymentNumber: `T-PAY-${suffix}`,
};

const password =
  `E2E-${randomBytes(16).toString("hex")}`;

let adminId;

const today = new Date()
  .toISOString()
  .slice(0, 10);

const futureDate = new Date(
  Date.now() + 3 * 24 * 60 * 60 * 1000
)
  .toISOString()
  .slice(0, 10);

before(async () => {
  const passwordHash = await bcrypt.hash(
    password,
    8
  );

  const result = await pool.query(
    `
    INSERT INTO app.users (
      username,
      full_name,
      email,
      password_hash,
      role,
      status
    )
    VALUES ($1, $2, $3, $4, 'ADMIN', 'ACTIVE')
    RETURNING id
    `,
    [
      testData.username,
      "E2E Test Admin",
      testData.email,
      passwordHash,
    ]
  );

  adminId = result.rows[0].id;
});

after(async () => {
  try {
    await pool.query(
      `
      DELETE FROM app.payments
      WHERE payment_number = $1
      `,
      [testData.paymentNumber]
    );

    await pool.query(
      `
      DELETE FROM app.invoices
      WHERE invoice_number = $1
      `,
      [testData.invoiceNumber]
    );

    await pool.query(
      `
      DELETE FROM app.inventory_movements
      WHERE notes ILIKE $1
      `,
      [`%${suffix}%`]
    );

    await pool.query(
      `
      DELETE FROM app.deliveries
      WHERE delivery_number = $1
      `,
      [testData.deliveryNumber]
    );

    await pool.query(
      `
      DELETE FROM app.sales_orders
      WHERE so_number = $1
      `,
      [testData.soNumber]
    );

    await pool.query(
      `
      DELETE FROM app.goods_receipts
      WHERE receipt_number = $1
      `,
      [testData.receiptNumber]
    );

    await pool.query(
      `
      DELETE FROM app.purchase_orders
      WHERE po_number = $1
      `,
      [testData.poNumber]
    );

    await pool.query(
      `
      DELETE FROM app.products
      WHERE sku = $1
      `,
      [testData.sku]
    );

    await pool.query(
      `
      DELETE FROM app.categories
      WHERE category_code = $1
      `,
      [testData.categoryCode]
    );

    await pool.query(
      `
      DELETE FROM app.suppliers
      WHERE supplier_code = $1
      `,
      [testData.supplierCode]
    );

    await pool.query(
      `
      DELETE FROM app.customers
      WHERE customer_code = $1
      `,
      [testData.customerCode]
    );

    await pool.query(
      `
      DELETE FROM app.users
      WHERE username = $1
      `,
      [testData.username]
    );
  } finally {
    await pool.end();
  }
});

test(
  "complete purchasing to payment flow",
  async () => {
    let response = await request(app)
      .post("/api/auth/login")
      .send({
        identifier: testData.username,
        password,
      });

    assert.equal(response.status, 200);

    const token =
      response.body.data.access_token;

    const authorization = `Bearer ${token}`;

    response = await request(app)
      .post("/api/suppliers")
      .set("Authorization", authorization)
      .send({
        supplier_code: testData.supplierCode,
        supplier_name: "E2E Test Supplier",
        payment_terms_days: 14,
      });

    assert.equal(response.status, 201);

    const supplierId = response.body.data.id;

    response = await request(app)
      .post("/api/categories")
      .set("Authorization", authorization)
      .send({
        category_code: testData.categoryCode,
        category_name: `E2E Category ${suffix}`,
      });

    assert.equal(response.status, 201);

    const categoryId = response.body.data.id;

    response = await request(app)
      .post("/api/products")
      .set("Authorization", authorization)
      .send({
        sku: testData.sku,
        product_name: "E2E Test Product",
        category_id: categoryId,
        supplier_id: supplierId,
        unit: "PCS",
        purchase_price: 10000,
        selling_price: 15000,
        minimum_stock: 3,
      });

    assert.equal(response.status, 201);

    const productId = response.body.data.id;

    response = await request(app)
      .post("/api/customers")
      .set("Authorization", authorization)
      .send({
        customer_code: testData.customerCode,
        customer_name: "E2E Test Customer",
        payment_terms_days: 14,
        credit_limit: 1000000,
      });

    assert.equal(response.status, 201);

    const customerId = response.body.data.id;

    response = await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", authorization)
      .send({
        po_number: testData.poNumber,
        supplier_id: supplierId,
        order_date: today,
        expected_date: futureDate,
        notes: `E2E purchase ${suffix}`,
        items: [
          {
            product_id: productId,
            quantity: 10,
            unit_price: 10000,
          },
        ],
      });

    assert.equal(response.status, 201);
    assert.equal(
      response.body.data.created_by,
      adminId
    );

    const purchaseOrderId =
      response.body.data.id;

    const purchaseOrderItemId =
      response.body.data.items[0].id;

    response = await request(app)
      .patch(
        `/api/purchase-orders/${purchaseOrderId}/status`
      )
      .set("Authorization", authorization)
      .send({ status: "SUBMITTED" });

    assert.equal(response.status, 200);
    assert.equal(
      response.body.data.status,
      "SUBMITTED"
    );

    response = await request(app)
      .post("/api/goods-receipts")
      .set("Authorization", authorization)
      .send({
        receipt_number: testData.receiptNumber,
        purchase_order_id: purchaseOrderId,
        notes: `E2E receipt ${suffix}`,
        items: [
          {
            purchase_order_item_id:
              purchaseOrderItemId,
            quantity_received: 10,
            quantity_damaged: 1,
          },
        ],
      });

    assert.equal(response.status, 201);
    assert.equal(
      response.body.data.received_by,
      adminId
    );
    assert.equal(
      response.body.data.purchase_order_status,
      "RECEIVED"
    );

    const goodsReceiptId =
      response.body.data.id;

    response = await request(app)
      .get(`/api/products/${productId}`)
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(
      Number(response.body.data.current_stock),
      9
    );

    response = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", authorization)
      .send({
        so_number: testData.soNumber,
        customer_id: customerId,
        order_date: today,
        requested_delivery_date: futureDate,
        notes: `E2E sales ${suffix}`,
        items: [
          {
            product_id: productId,
            quantity: 4,
            unit_price: 15000,
            discount_amount: 0,
          },
        ],
      });

    assert.equal(response.status, 201);
    assert.equal(
      response.body.data.created_by,
      adminId
    );

    const salesOrderId =
      response.body.data.id;

    const salesOrderItemId =
      response.body.data.items[0].id;

    response = await request(app)
      .patch(
        `/api/sales-orders/${salesOrderId}/status`
      )
      .set("Authorization", authorization)
      .send({ status: "CONFIRMED" });

    assert.equal(response.status, 200);
    assert.equal(
      response.body.data.status,
      "CONFIRMED"
    );

    response = await request(app)
      .post("/api/deliveries")
      .set("Authorization", authorization)
      .send({
        delivery_number:
          testData.deliveryNumber,
        sales_order_id: salesOrderId,
        delivery_date: today,
        recipient_name: "E2E Recipient",
        address: "E2E Test Address",
        notes: `E2E delivery ${suffix}`,
        items: [
          {
            sales_order_item_id:
              salesOrderItemId,
            quantity_delivered: 4,
          },
        ],
      });

    assert.equal(response.status, 201);
    assert.equal(
      response.body.data.created_by,
      adminId
    );

    const deliveryId = response.body.data.id;

    response = await request(app)
      .patch(
        `/api/deliveries/${deliveryId}/status`
      )
      .set("Authorization", authorization)
      .send({ status: "SHIPPED" });

    assert.equal(response.status, 200);
    assert.equal(
      response.body.data.status,
      "SHIPPED"
    );

    response = await request(app)
      .get(`/api/products/${productId}`)
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(
      Number(response.body.data.current_stock),
      5
    );

    response = await request(app)
      .patch(
        `/api/deliveries/${deliveryId}/status`
      )
      .set("Authorization", authorization)
      .send({ status: "DELIVERED" });

    assert.equal(response.status, 200);
    assert.equal(
      response.body.data.status,
      "DELIVERED"
    );
    assert.equal(
      response.body.data.sales_order_status,
      "DELIVERED"
    );

    response = await request(app)
      .post("/api/invoices")
      .set("Authorization", authorization)
      .send({
        invoice_number: testData.invoiceNumber,
        sales_order_id: salesOrderId,
        invoice_date: today,
        tax_amount: 0,
        notes: `E2E invoice ${suffix}`,
      });

    assert.equal(response.status, 201);
    assert.equal(
      Number(response.body.data.grand_total),
      60000
    );

    const invoiceId = response.body.data.id;

    response = await request(app)
      .post("/api/payments")
      .set("Authorization", authorization)
      .send({
        payment_number: testData.paymentNumber,
        invoice_id: invoiceId,
        payment_date: today,
        amount: 60000,
        method: "BANK_TRANSFER",
        reference_number: `REF-${suffix}`,
        notes: `E2E payment ${suffix}`,
      });

    assert.equal(response.status, 201);
    assert.equal(
      response.body.data.payment.received_by,
      adminId
    );
    assert.equal(
      response.body.data.invoice.status,
      "PAID"
    );
    assert.equal(
      Number(
        response.body.data.invoice
          .outstanding_amount
      ),
      0
    );

    response = await request(app)
      .get("/api/inventory-movements")
      .query({
        product_id: productId,
        limit: 100,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);

    const purchaseMovement =
      response.body.data.find(
        (movement) =>
          movement.reference_id ===
          goodsReceiptId
      );

    const salesMovement =
      response.body.data.find(
        (movement) =>
          movement.reference_id === deliveryId
      );

    assert.ok(purchaseMovement);
    assert.equal(
      purchaseMovement.movement_type,
      "PURCHASE_RECEIPT"
    );
    assert.equal(
      Number(purchaseMovement.quantity),
      9
    );
    assert.equal(
      purchaseMovement.created_by,
      adminId
    );

    assert.ok(salesMovement);
    assert.equal(
      salesMovement.movement_type,
      "SALES_ISSUE"
    );
    assert.equal(
      Number(salesMovement.quantity),
      4
    );
    assert.equal(
      salesMovement.created_by,
      adminId
    );
  }
);