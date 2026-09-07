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
  after,
  before,
  test,
} = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const request = require("supertest");

const pool = require("../src/config/database");
const app = require("../src/app");

const suffix = randomBytes(4)
  .toString("hex")
  .toUpperCase();
const automaticPrefix = `AT${suffix.slice(0, 6)}`;
const changedPrefix = `CF${suffix.slice(0, 6)}`;
const password =
  `Numbering-${randomBytes(16).toString("hex")}`;

const testData = {
  adminUsername: `number_admin_${suffix.toLowerCase()}`,
  adminEmail:
    `number.admin.${suffix.toLowerCase()}@local.test`,
  purchasingUsername:
    `number_purchasing_${suffix.toLowerCase()}`,
  purchasingEmail:
    `number.purchasing.${suffix.toLowerCase()}@local.test`,
  legacyCode: `LEGACY-${suffix}`,
  supplierNamePrefix: `Numbering Test ${suffix}`,
};

let originalSetting;

const login = (identifier) =>
  request(app)
    .post("/api/auth/login")
    .send({ identifier, password });

before(async () => {
  const settingResult = await pool.query(
    `
    SELECT *
    FROM app.code_number_settings
    WHERE module_key = 'SUPPLIER'
    `,
  );

  assert.equal(
    settingResult.rows.length,
    1,
    "Run database/migrations/001_code_number_settings.sql before this test",
  );

  originalSetting = settingResult.rows[0];

  await pool.query(
    `
    UPDATE app.code_number_settings
    SET is_automatic = false
    WHERE module_key = 'SUPPLIER'
    `,
  );

  const passwordHash = await bcrypt.hash(password, 8);

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
    VALUES
      ($1, 'Numbering Test Admin', $2, $3, 'ADMIN', 'ACTIVE'),
      ($4, 'Numbering Test Purchasing', $5, $3, 'PURCHASING', 'ACTIVE')
    `,
    [
      testData.adminUsername,
      testData.adminEmail,
      passwordHash,
      testData.purchasingUsername,
      testData.purchasingEmail,
    ],
  );
});

after(async () => {
  try {
    await pool.query(
      `
      DELETE FROM app.suppliers
      WHERE supplier_name LIKE $1
      `,
      [`${testData.supplierNamePrefix}%`],
    );

    if (originalSetting) {
      await pool.query(
        `
        UPDATE app.code_number_settings
        SET
          is_automatic = $1,
          prefix = $2,
          separator = $3,
          digit_length = $4,
          include_year = $5,
          include_month = $6,
          reset_rule = $7,
          last_number = $8,
          last_period = $9,
          updated_by = $10,
          created_at = $11,
          updated_at = $12
        WHERE module_key = 'SUPPLIER'
        `,
        [
          originalSetting.is_automatic,
          originalSetting.prefix,
          originalSetting.separator,
          originalSetting.digit_length,
          originalSetting.include_year,
          originalSetting.include_month,
          originalSetting.reset_rule,
          originalSetting.last_number,
          originalSetting.last_period,
          originalSetting.updated_by,
          originalSetting.created_at,
          originalSetting.updated_at,
        ],
      );
    }

    await pool.query(
      `
      DELETE FROM app.users
      WHERE username = ANY($1::VARCHAR[])
      `,
      [[
        testData.adminUsername,
        testData.purchasingUsername,
      ]],
    );
  } finally {
    await pool.end();
  }
});

test(
  "code numbering settings generate concurrent unique codes, preserve old codes, validate format, and enforce RBAC",
  async () => {
    const adminLogin = await login(testData.adminUsername);
    const purchasingLogin = await login(
      testData.purchasingUsername,
    );

    assert.equal(adminLogin.status, 200);
    assert.equal(purchasingLogin.status, 200);

    const adminAuthorization =
      `Bearer ${adminLogin.body.data.access_token}`;
    const purchasingAuthorization =
      `Bearer ${purchasingLogin.body.data.access_token}`;

    let response = await request(app)
      .get("/api/code-number-settings")
      .set("Authorization", adminAuthorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 11);

    response = await request(app)
      .post("/api/suppliers")
      .set("Authorization", adminAuthorization)
      .send({
        supplier_code: testData.legacyCode,
        supplier_name:
          `${testData.supplierNamePrefix} Legacy`,
      });

    assert.equal(response.status, 201);
    assert.equal(
      response.body.data.supplier_code,
      testData.legacyCode,
    );

    response = await request(app)
      .put("/api/code-number-settings/SUPPLIER")
      .set("Authorization", purchasingAuthorization)
      .send({
        is_automatic: true,
        prefix: automaticPrefix,
        separator: "-",
        digit_length: 4,
        include_year: false,
        include_month: false,
        reset_rule: "NEVER",
        next_number: 1,
      });

    assert.equal(response.status, 403);

    response = await request(app)
      .put("/api/code-number-settings/SUPPLIER")
      .set("Authorization", adminAuthorization)
      .send({
        is_automatic: true,
        prefix: automaticPrefix,
        separator: "-",
        digit_length: 4,
        include_year: false,
        include_month: false,
        reset_rule: "NEVER",
        next_number: 1,
      });

    assert.equal(response.status, 200);
    assert.equal(
      response.body.data.preview,
      `${automaticPrefix}-0001`,
    );

    const concurrentResponses = await Promise.all(
      ["Concurrent A", "Concurrent B"].map((name) =>
        request(app)
          .post("/api/suppliers")
          .set("Authorization", adminAuthorization)
          .send({
            supplier_name:
              `${testData.supplierNamePrefix} ${name}`,
          }),
      ),
    );

    concurrentResponses.forEach((result) => {
      assert.equal(result.status, 201);
    });

    const generatedCodes = concurrentResponses
      .map((result) => result.body.data.supplier_code)
      .sort();

    assert.deepEqual(generatedCodes, [
      `${automaticPrefix}-0001`,
      `${automaticPrefix}-0002`,
    ]);

    const currentYear = String(new Date().getFullYear());

    response = await request(app)
      .put("/api/code-number-settings/SUPPLIER")
      .set("Authorization", adminAuthorization)
      .send({
        is_automatic: true,
        prefix: changedPrefix,
        separator: "/",
        digit_length: 3,
        include_year: true,
        include_month: false,
        reset_rule: "YEARLY",
        next_number: 7,
      });

    assert.equal(response.status, 200);

    response = await request(app)
      .post("/api/suppliers")
      .set("Authorization", adminAuthorization)
      .send({
        supplier_name:
          `${testData.supplierNamePrefix} Changed Format`,
      });

    assert.equal(response.status, 201);
    assert.equal(
      response.body.data.supplier_code,
      `${changedPrefix}/${currentYear}/007`,
    );

    const legacyResult = await pool.query(
      `
      SELECT supplier_code
      FROM app.suppliers
      WHERE supplier_name = $1
      `,
      [`${testData.supplierNamePrefix} Legacy`],
    );

    assert.equal(
      legacyResult.rows[0].supplier_code,
      testData.legacyCode,
    );

    response = await request(app)
      .put("/api/code-number-settings/SUPPLIER")
      .set("Authorization", adminAuthorization)
      .send({
        is_automatic: true,
        prefix: "SUP",
        separator: "-",
        digit_length: 4,
        include_year: false,
        include_month: false,
        reset_rule: "MONTHLY",
        next_number: 1,
      });

    assert.equal(response.status, 400);
  },
);
