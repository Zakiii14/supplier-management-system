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
  adminUsername: "user_mgmt_admin",
  salesUsername: "user_mgmt_sales",
  financeUsername: "user_mgmt_finance",
  warehouseUsername: "user_mgmt_warehouse",
};

const testUsernames = Object.values(testData);

const adminPassword =
  `Admin-${randomBytes(16).toString("hex")}`;

const salesPassword =
  `Sales-${randomBytes(16).toString("hex")}`;

const financePassword =
  `Finance-${randomBytes(16).toString("hex")}`;

const updatedFinancePassword =
  `Updated-${randomBytes(16).toString("hex")}`;

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
    [testUsernames],
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
      testData.adminUsername,
      "User Management Admin",
      "user.mgmt.admin@local.test",
      adminHash,
      testData.salesUsername,
      "User Management Sales",
      "user.mgmt.sales@local.test",
      salesHash,
    ],
  );
});

after(async () => {
  await pool.query(
    `
    DELETE FROM app.users
    WHERE username = ANY($1::VARCHAR[])
    `,
    [testUsernames],
  );

  await pool.end();
});

test(
  "user management supports filters, CRUD, password reset, validation, and RBAC",
  async () => {
    const adminLoginResponse = await login(
      testData.adminUsername,
      adminPassword,
    );

    assert.equal(adminLoginResponse.status, 200);

    const adminId =
      adminLoginResponse.body.data.user.id;

    const authorization =
      `Bearer ${adminLoginResponse.body.data.access_token}`;

    const salesLoginResponse = await login(
      testData.salesUsername,
      salesPassword,
    );

    assert.equal(salesLoginResponse.status, 200);

    const salesAuthorization =
      `Bearer ${salesLoginResponse.body.data.access_token}`;

    let response = await request(app)
      .post("/api/users")
      .set("Authorization", authorization)
      .send({
        username:
          testData.financeUsername.toUpperCase(),
        full_name: "Integration Finance",
        email: "USER.MGMT.FINANCE@LOCAL.TEST",
        password: financePassword,
        role: "finance",
        status: "active",
      });

    assert.equal(response.status, 201);
    assert.equal(response.body.success, true);
    assert.equal(
      response.body.data.username,
      testData.financeUsername,
    );
    assert.equal(
      response.body.data.email,
      "user.mgmt.finance@local.test",
    );
    assert.equal(response.body.data.role, "FINANCE");
    assert.equal(response.body.data.status, "ACTIVE");
    assert.equal(
      Object.hasOwn(
        response.body.data,
        "password_hash",
      ),
      false,
    );

    const financeUserId = response.body.data.id;

    response = await request(app)
      .post("/api/users")
      .set("Authorization", authorization)
      .send({
        username: testData.warehouseUsername,
        full_name: "Integration Warehouse",
        email: "user.mgmt.warehouse@local.test",
        password: financePassword,
        role: "WAREHOUSE",
        status: "INACTIVE",
      });

    assert.equal(response.status, 201);
    assert.equal(response.body.data.status, "INACTIVE");

    response = await request(app)
      .post("/api/users")
      .set("Authorization", authorization)
      .send({
        username:
          testData.financeUsername.toUpperCase(),
        full_name: "Duplicate Finance",
        password: financePassword,
        role: "FINANCE",
      });

    assert.equal(response.status, 409);
    assert.equal(
      response.body.message,
      "Username already exists",
    );

    response = await request(app)
      .post("/api/users")
      .set("Authorization", authorization)
      .send({
        username: "user_mgmt_invalid_email",
        full_name: "Invalid Email",
        email: "not-an-email",
        password: financePassword,
        role: "FINANCE",
      });

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Invalid email format",
    );

    response = await request(app)
      .get("/api/users")
      .query({
        search: "user_mgmt_",
        page: 1,
        limit: 2,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 2);
    assert.deepEqual(response.body.pagination, {
      page: 1,
      limit: 2,
      total: 4,
      total_pages: 2,
    });

    response = await request(app)
      .get("/api/users")
      .query({
        search: "user_mgmt_",
        page: 2,
        limit: 2,
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 2);
    assert.equal(response.body.pagination.page, 2);

    response = await request(app)
      .get("/api/users")
      .query({
        search: "user_mgmt_",
        role: "finance",
        status: "active",
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.pagination.total, 1);
    assert.equal(
      response.body.data[0].username,
      testData.financeUsername,
    );

    response = await request(app)
      .get("/api/users")
      .query({
        search: "user_mgmt_",
        status: "inactive",
      })
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.pagination.total, 1);
    assert.equal(
      response.body.data[0].username,
      testData.warehouseUsername,
    );

    response = await request(app)
      .get("/api/users")
      .query({ page: 0, limit: 10 })
      .set("Authorization", authorization);

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Invalid pagination parameters",
    );

    response = await request(app)
      .get(`/api/users/${financeUserId}`)
      .set("Authorization", authorization);

    assert.equal(response.status, 200);
    assert.equal(
      response.body.data.username,
      testData.financeUsername,
    );
    assert.equal(
      Object.hasOwn(
        response.body.data,
        "password_hash",
      ),
      false,
    );

    response = await request(app)
      .patch(`/api/users/${financeUserId}`)
      .set("Authorization", authorization)
      .send({
        full_name: "Updated Finance Manager",
        email: "UPDATED.FINANCE@LOCAL.TEST",
        role: "manager",
      });

    assert.equal(response.status, 200);
    assert.equal(
      response.body.data.full_name,
      "Updated Finance Manager",
    );
    assert.equal(
      response.body.data.email,
      "updated.finance@local.test",
    );
    assert.equal(response.body.data.role, "MANAGER");

    response = await request(app)
      .patch(`/api/users/${financeUserId}/password`)
      .set("Authorization", authorization)
      .send({ password: "short" });

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Password must contain at least 8 characters",
    );

    response = await request(app)
      .patch(`/api/users/${financeUserId}/password`)
      .set("Authorization", authorization)
      .send({ password: updatedFinancePassword });

    assert.equal(response.status, 200);

    response = await login(
      testData.financeUsername,
      updatedFinancePassword,
    );

    assert.equal(response.status, 200);
    assert.equal(
      response.body.data.user.role,
      "MANAGER",
    );

    response = await request(app)
      .patch(`/api/users/${financeUserId}`)
      .set("Authorization", authorization)
      .send({ status: "INACTIVE" });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "INACTIVE");

    response = await login(
      testData.financeUsername,
      updatedFinancePassword,
    );

    assert.equal(response.status, 401);

    response = await request(app)
      .patch(`/api/users/${financeUserId}`)
      .set("Authorization", authorization)
      .send({ status: "ACTIVE" });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "ACTIVE");

    response = await request(app)
      .patch(`/api/users/${adminId}`)
      .set("Authorization", authorization)
      .send({ status: "INACTIVE" });

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "You cannot deactivate your own account",
    );

    response = await request(app)
      .patch(`/api/users/${adminId}`)
      .set("Authorization", authorization)
      .send({ role: "SALES" });

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "You cannot change your own role",
    );

    response = await request(app)
      .get("/api/users")
      .set("Authorization", salesAuthorization);

    assert.equal(response.status, 403);

    response = await request(app)
      .get("/api/users/not-a-uuid")
      .set("Authorization", authorization);

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Invalid user ID",
    );
  },
);
