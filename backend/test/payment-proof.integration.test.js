const path = require("node:path");
const { randomBytes } = require("node:crypto");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env.test"),
  override: true,
});

if (process.env.DB_NAME !== "supplier_management_test") {
  throw new Error("Integration tests must use supplier_management_test");
}

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const pool = require("../src/config/database");
const app = require("../src/app");

const suffix = randomBytes(4).toString("hex").toUpperCase();
const today = new Date().toISOString().slice(0, 10);
const ids = {};
let authorization;
let originalSettings;

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF");

before(async () => {
  const migrationCheck = await pool.query(
    `SELECT to_regclass('app.payment_proofs') AS payment_proofs`,
  );
  assert.ok(
    migrationCheck.rows[0].payment_proofs,
    "Run database/migrations/002_payment_tracking_and_proofs.sql before this test",
  );

  originalSettings = (
    await pool.query("SELECT * FROM app.payment_settings WHERE id = 1")
  ).rows[0];
  await pool.query(
    `
    UPDATE app.payment_settings
    SET
      require_purchase_transfer_proof = true,
      require_sales_transfer_proof = true
    WHERE id = 1
    `,
  );

  const password = `Proof-${randomBytes(12).toString("hex")}`;
  const passwordHash = await bcrypt.hash(password, 8);
  ids.user = (
    await pool.query(
      `
      INSERT INTO app.users (username, full_name, email, password_hash, role, status)
      VALUES ($1, 'Payment Proof Admin', $2, $3, 'ADMIN', 'ACTIVE')
      RETURNING id
      `,
      [
        `proof_admin_${suffix.toLowerCase()}`,
        `proof.${suffix.toLowerCase()}@local.test`,
        passwordHash,
      ],
    )
  ).rows[0].id;

  const login = await request(app).post("/api/auth/login").send({
    identifier: `proof_admin_${suffix.toLowerCase()}`,
    password,
  });
  assert.equal(login.status, 200);
  authorization = `Bearer ${login.body.data.access_token}`;

  ids.supplier = (
    await pool.query(
      `
      INSERT INTO app.suppliers (supplier_code, supplier_name, status)
      VALUES ($1, $2, 'ACTIVE') RETURNING id
      `,
      [`PROOF-SUP-${suffix}`, `Proof Supplier ${suffix}`],
    )
  ).rows[0].id;
  ids.category = (
    await pool.query(
      `INSERT INTO app.categories (category_code, category_name) VALUES ($1, $2) RETURNING id`,
      [`PROOF-CAT-${suffix}`, `Proof Category ${suffix}`],
    )
  ).rows[0].id;
  ids.product = (
    await pool.query(
      `
      INSERT INTO app.products (
        sku, product_name, category_id, supplier_id, purchase_price, selling_price
      ) VALUES ($1, $2, $3, $4, 2000, 3000) RETURNING id
      `,
      [`PROOF-SKU-${suffix}`, `Proof Product ${suffix}`, ids.category, ids.supplier],
    )
  ).rows[0].id;
  ids.purchaseOrder = (
    await pool.query(
      `
      INSERT INTO app.purchase_orders (
        po_number, supplier_id, order_date, status, created_by
      ) VALUES ($1, $2, $3, 'SUBMITTED', $4) RETURNING id
      `,
      [`PROOF-PO-${suffix}`, ids.supplier, today, ids.user],
    )
  ).rows[0].id;
  await pool.query(
    `
    INSERT INTO app.purchase_order_items (
      purchase_order_id, product_id, quantity, unit_price
    ) VALUES ($1, $2, 1, 2000)
    `,
    [ids.purchaseOrder, ids.product],
  );

  ids.customer = (
    await pool.query(
      `
      INSERT INTO app.customers (customer_code, customer_name, status)
      VALUES ($1, $2, 'ACTIVE') RETURNING id
      `,
      [`PROOF-CUS-${suffix}`, `Proof Customer ${suffix}`],
    )
  ).rows[0].id;
  ids.salesOrder = (
    await pool.query(
      `
      INSERT INTO app.sales_orders (
        so_number, customer_id, order_date, status, created_by
      ) VALUES ($1, $2, $3, 'DELIVERED', $4) RETURNING id
      `,
      [`PROOF-SO-${suffix}`, ids.customer, today, ids.user],
    )
  ).rows[0].id;
  ids.invoice = (
    await pool.query(
      `
      INSERT INTO app.invoices (
        invoice_number, sales_order_id, customer_id, invoice_date, due_date,
        subtotal, grand_total, paid_amount, status
      ) VALUES ($1, $2, $3, $4, $4, 1000, 1000, 0, 'UNPAID') RETURNING id
      `,
      [`PROOF-INV-${suffix}`, ids.salesOrder, ids.customer, today],
    )
  ).rows[0].id;
});

after(async () => {
  try {
    await pool.query("DELETE FROM app.payments WHERE invoice_id = $1", [ids.invoice]);
    await pool.query("DELETE FROM app.invoices WHERE id = $1", [ids.invoice]);
    await pool.query("DELETE FROM app.sales_orders WHERE id = $1", [ids.salesOrder]);
    await pool.query("DELETE FROM app.customers WHERE id = $1", [ids.customer]);
    await pool.query(
      "DELETE FROM app.supplier_payments WHERE purchase_order_id = $1",
      [ids.purchaseOrder],
    );
    await pool.query(
      "DELETE FROM app.purchase_order_items WHERE purchase_order_id = $1",
      [ids.purchaseOrder],
    );
    await pool.query("DELETE FROM app.purchase_orders WHERE id = $1", [ids.purchaseOrder]);
    await pool.query("DELETE FROM app.products WHERE id = $1", [ids.product]);
    await pool.query("DELETE FROM app.categories WHERE id = $1", [ids.category]);
    await pool.query("DELETE FROM app.suppliers WHERE id = $1", [ids.supplier]);
    if (originalSettings) {
      await pool.query(
        `
        UPDATE app.payment_settings
        SET
          default_purchase_scheme = $1,
          default_purchase_term_days = $2,
          default_down_payment_percent = $3,
          require_purchase_transfer_proof = $4,
          require_sales_transfer_proof = $5,
          updated_by = $6
        WHERE id = 1
        `,
        [
          originalSettings.default_purchase_scheme,
          originalSettings.default_purchase_term_days,
          originalSettings.default_down_payment_percent,
          originalSettings.require_purchase_transfer_proof,
          originalSettings.require_sales_transfer_proof,
          originalSettings.updated_by,
        ],
      );
    }
    await pool.query("DELETE FROM app.users WHERE id = $1", [ids.user]);
  } finally {
    await pool.end();
  }
});

test("customer and supplier payment proofs can be uploaded, replaced, viewed, and deleted", async () => {
  let response = await request(app)
    .get("/api/payment-settings")
    .set("Authorization", authorization);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.require_sales_transfer_proof, true);

  response = await request(app)
    .put("/api/payment-settings")
    .set("Authorization", authorization)
    .send({
      default_purchase_scheme: "DOWN_PAYMENT",
      default_purchase_term_days: 14,
      default_down_payment_percent: 35,
      require_purchase_transfer_proof: true,
      require_sales_transfer_proof: true,
    });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.default_purchase_scheme, "DOWN_PAYMENT");

  response = await request(app)
    .post("/api/payments")
    .set("Authorization", authorization)
    .field("payment_number", `PROOF-PAY-${suffix}`)
    .field("invoice_id", ids.invoice)
    .field("payment_date", today)
    .field("amount", "1000")
    .field("method", "BANK_TRANSFER");
  assert.equal(response.status, 400);

  response = await request(app)
    .post("/api/payments")
    .set("Authorization", authorization)
    .field("payment_number", `PROOF-PAY-${suffix}`)
    .field("invoice_id", ids.invoice)
    .field("payment_date", today)
    .field("amount", "1000")
    .field("method", "BANK_TRANSFER")
    .attach("proofs", png, { filename: "transfer.png", contentType: "image/png" });
  assert.equal(response.status, 201);
  ids.customerPayment = response.body.data.payment.id;

  response = await request(app)
    .get(`/api/payments/${ids.customerPayment}`)
    .set("Authorization", authorization);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.proofs.length, 1);
  let proofId = response.body.data.proofs[0].id;

  response = await request(app)
    .put(`/api/payments/${ids.customerPayment}/proofs/${proofId}`)
    .set("Authorization", authorization)
    .attach("proof", pdf, { filename: "transfer.pdf", contentType: "application/pdf" });
  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].mime_type, "application/pdf");

  response = await request(app)
    .get(`/api/payments/${ids.customerPayment}/proofs/${proofId}/content`)
    .set("Authorization", authorization);
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "application/pdf");

  response = await request(app)
    .delete(`/api/payments/${ids.customerPayment}/proofs/${proofId}`)
    .set("Authorization", authorization);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 0);

  response = await request(app)
    .post(`/api/purchase-orders/${ids.purchaseOrder}/supplier-payments`)
    .set("Authorization", authorization)
    .field("payment_number", `PROOF-SPAY-${suffix}`)
    .field("payment_date", today)
    .field("amount", "2000")
    .field("method", "BANK_TRANSFER")
    .attach("proofs", png, { filename: "supplier-transfer.png", contentType: "image/png" });
  assert.equal(response.status, 201);
  ids.supplierPayment = response.body.data.id;
  assert.equal(response.body.data.proofs.length, 1);
  proofId = response.body.data.proofs[0].id;

  response = await request(app)
    .put(
      `/api/purchase-orders/${ids.purchaseOrder}/supplier-payments/${ids.supplierPayment}/proofs/${proofId}`,
    )
    .set("Authorization", authorization)
    .attach("proof", pdf, {
      filename: "supplier-transfer.pdf",
      contentType: "application/pdf",
    });
  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].mime_type, "application/pdf");

  response = await request(app)
    .get(
      `/api/purchase-orders/${ids.purchaseOrder}/supplier-payments/${ids.supplierPayment}/proofs/${proofId}/content`,
    )
    .set("Authorization", authorization);
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "application/pdf");

  response = await request(app)
    .post(`/api/purchase-orders/${ids.purchaseOrder}/supplier-payments`)
    .set("Authorization", authorization)
    .field("payment_number", `PROOF-SPAY-OVER-${suffix}`)
    .field("payment_date", today)
    .field("amount", "1")
    .field("method", "CASH");
  assert.equal(response.status, 400);

  response = await request(app)
    .delete(
      `/api/purchase-orders/${ids.purchaseOrder}/supplier-payments/${ids.supplierPayment}/proofs/${proofId}`,
    )
    .set("Authorization", authorization);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 0);
});
