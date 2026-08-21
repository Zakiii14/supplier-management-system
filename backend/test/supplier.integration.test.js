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
  username: `supplier_admin_${suffix.toLowerCase()}`,
  email: `supplier.admin.${suffix.toLowerCase()}@local.test`,
  primaryCode: `SUP-CASE-${suffix}`,
  secondaryCode: `SUP-SECOND-${suffix}`,
  searchableEmail:
    `contact.${suffix.toLowerCase()}@local.test`,
};

const password =
  `Supplier-${randomBytes(16).toString("hex")}`;

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
      'Supplier Test Admin',
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
});

after(async () => {
  try {
    await pool.query(
      `
      DELETE FROM app.suppliers
      WHERE UPPER(supplier_code)
        = ANY($1::VARCHAR[])
      `,
      [[
        testData.primaryCode,
        testData.secondaryCode,
      ]],
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
  "supplier code is uppercase and case-insensitively unique",
  async () => {
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        identifier: testData.username,
        password,
      });

    assert.equal(loginResponse.status, 200);

    const authorization =
      `Bearer ${loginResponse.body.data.access_token}`;

    let response = await request(app)
      .post("/api/suppliers")
      .set("Authorization", authorization)
      .send({
        supplier_code:
          testData.primaryCode.toLowerCase(),
        supplier_name: "Primary Test Supplier",
        contact_person: "Primary Contact",
        phone: "081234567890",
        email: testData.searchableEmail,
        city: "Purwokerto",
        payment_terms_days: 14,
      });

    assert.equal(response.status, 201);
    assert.equal(
      response.body.data.supplier_code,
      testData.primaryCode,
    );

    const primarySupplierId =
      response.body.data.id;

    response = await request(app)
      .get("/api/suppliers")
      .query({
        search: testData.searchableEmail,
        page: 1,
        limit: 10,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);

    assert.equal(
      response.body.data.some(
        (supplier) =>
          supplier.id === primarySupplierId,
      ),
      true,
    );

    response = await request(app)
      .post("/api/suppliers")
      .set("Authorization", authorization)
      .send({
        supplier_code:
          testData.primaryCode.toLowerCase(),
        supplier_name: "Duplicate Test Supplier",
      });

    assert.equal(response.status, 409);
    assert.equal(
      response.body.message,
      "Supplier code already exists",
    );

    response = await request(app)
      .post("/api/suppliers")
      .set("Authorization", authorization)
      .send({
        supplier_code: testData.secondaryCode,
        supplier_name: "Secondary Test Supplier",
        contact_person: "Secondary Contact",
        city: "Banyumas",
        payment_terms_days: 30,
      });

    assert.equal(response.status, 201);

    const secondarySupplierId =
      response.body.data.id;

    response = await request(app)
      .put(
        `/api/suppliers/${secondarySupplierId}`,
      )
      .set("Authorization", authorization)
      .send({
        supplier_code:
          testData.primaryCode.toLowerCase(),
        supplier_name: "Secondary Test Supplier",
        contact_person: "Secondary Contact",
        city: "Banyumas",
        payment_terms_days: 30,
      });

    assert.equal(response.status, 409);
    assert.equal(
      response.body.message,
      "Supplier code already exists",
    );
  },
);