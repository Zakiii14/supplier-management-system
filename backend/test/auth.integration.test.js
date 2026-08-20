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

const adminUsername = "integration_admin";
const salesUsername = "integration_sales";

const adminPassword =
  `Admin-${randomBytes(16).toString("hex")}`;

const salesPassword =
  `Sales-${randomBytes(16).toString("hex")}`;

const login = (identifier, password) =>
  request(app)
    .post("/api/auth/login")
    .send({ identifier, password });

before(async () => {
  await pool.query(
    `
    DELETE FROM app.users
    WHERE username = ANY($1::VARCHAR[])
    `,
    [[adminUsername, salesUsername]]
  );

  const [adminHash, salesHash] =
    await Promise.all([
      bcrypt.hash(adminPassword, 8),
      bcrypt.hash(salesPassword, 8),
    ]);

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
      ($1, $2, $3, $4, 'ADMIN', 'ACTIVE'),
      ($5, $6, $7, $8, 'SALES', 'ACTIVE')
    `,
    [
      adminUsername,
      "Integration Admin",
      "integration.admin@local.test",
      adminHash,
      salesUsername,
      "Integration Sales",
      "integration.sales@local.test",
      salesHash,
    ]
  );
});

after(async () => {
  await pool.query(
    `
    DELETE FROM app.users
    WHERE username = ANY($1::VARCHAR[])
    `,
    [[adminUsername, salesUsername]]
  );

  await pool.end();
});

test("active user can log in", async () => {
  const response = await login(
    adminUsername,
    adminPassword
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  assert.equal(
    typeof response.body.data.access_token,
    "string"
  );

  assert.equal(
    response.body.data.user.username,
    adminUsername
  );

  assert.equal(
    response.body.data.user.role,
    "ADMIN"
  );

  assert.equal(
    Object.hasOwn(
      response.body.data.user,
      "password_hash"
    ),
    false
  );
});

test(
  "authenticated user can access current profile",
  async () => {
    const loginResponse = await login(
      adminUsername,
      adminPassword
    );

    const token =
      loginResponse.body.data.access_token;

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(
      response.body.data.username,
      adminUsername
    );
    assert.equal(response.body.data.role, "ADMIN");
  }
);

test(
  "admin can access user management",
  async () => {
    const loginResponse = await login(
      adminUsername,
      adminPassword
    );

    const token =
      loginResponse.body.data.access_token;

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(
      Array.isArray(response.body.data),
      true
    );

    assert.equal(
      response.body.data.some(
        (user) =>
          user.username === adminUsername
      ),
      true
    );
  }
);

test(
  "sales user cannot access user management",
  async () => {
    const loginResponse = await login(
      salesUsername,
      salesPassword
    );

    const token =
      loginResponse.body.data.access_token;

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 403);
    assert.deepEqual(response.body, {
      success: false,
      message:
        "You do not have permission to access this resource",
    });
  }
);

test(
  "login rejects incorrect password",
  async () => {
    const response = await login(
      adminUsername,
      "incorrect-password"
    );

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, {
      success: false,
      message: "Invalid credentials",
    });
  }
);