const path = require("node:path");
const { randomBytes, randomUUID } = require("node:crypto");

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

const usernames = [
  "demo_safety_admin",
  "demo_safety_sales",
];
const password = `DemoSafety-${randomBytes(16).toString("hex")}`;
const previousDemoMode = process.env.DEMO_MODE;

const login = (identifier) =>
  request(app)
    .post("/api/auth/login")
    .send({ identifier, password, client_id: randomUUID() });

before(async () => {
  process.env.DEMO_MODE = "false";

  await pool.query(
    `DELETE FROM app.users WHERE username = ANY($1::VARCHAR[])`,
    [usernames],
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
      ($1, 'Demo Safety Admin', 'demo.safety.admin@local.test', $3, 'ADMIN', 'ACTIVE'),
      ($2, 'Demo Safety Sales', 'demo.safety.sales@local.test', $3, 'SALES', 'ACTIVE')
    `,
    [usernames[0], usernames[1], passwordHash],
  );
});

after(async () => {
  process.env.DEMO_MODE = previousDemoMode;

  await pool.query(
    `DELETE FROM app.users WHERE username = ANY($1::VARCHAR[])`,
    [usernames],
  );

  await pool.end();
});

test(
  "public demo mode keeps login and self profile available while blocking sensitive mutations",
  async () => {
    process.env.DEMO_MODE = "true";

    const adminLogin = await login(usernames[0]);
    const salesLogin = await login(usernames[1]);

    assert.equal(adminLogin.status, 200);
    assert.equal(salesLogin.status, 200);

    const adminAuthorization =
      `Bearer ${adminLogin.body.data.access_token}`;
    const salesAuthorization =
      `Bearer ${salesLogin.body.data.access_token}`;
    const adminId = adminLogin.body.data.user.id;
    const salesId = salesLogin.body.data.user.id;

    let response = await request(app)
      .get("/api/users")
      .set("Authorization", adminAuthorization);

    assert.equal(response.status, 200);

    response = await request(app)
      .delete(`/api/users/${salesId}/avatar`)
      .set("Authorization", salesAuthorization);

    assert.equal(response.status, 200);

    response = await request(app)
      .delete(`/api/users/${salesId}/avatar`)
      .set("Authorization", adminAuthorization);

    assert.equal(response.status, 403);

    response = await request(app)
      .delete(`/api/users/${adminId}/avatar`)
      .set("Authorization", adminAuthorization);

    assert.equal(response.status, 200);

    const blockedRequests = [
      () =>
        request(app)
          .post("/api/users")
          .set("Authorization", adminAuthorization)
          .send({}),
      () =>
        request(app)
          .post("/api/users/invite")
          .set("Authorization", adminAuthorization)
          .send({}),
      () =>
        request(app)
          .post(`/api/users/${salesId}/resend-invitation`)
          .set("Authorization", adminAuthorization),
      () =>
        request(app)
          .patch(`/api/users/${salesId}`)
          .set("Authorization", adminAuthorization)
          .send({ full_name: "Changed by Demo Admin" }),
      () =>
        request(app)
          .patch(`/api/users/${salesId}/password`)
          .set("Authorization", adminAuthorization)
          .send({ password: "ChangedPassword123!" }),
      () =>
        request(app)
          .put("/api/code-number-settings/SUPPLIER")
          .set("Authorization", adminAuthorization)
          .send({}),
      () =>
        request(app)
          .put("/api/payment-settings")
          .set("Authorization", adminAuthorization)
          .send({}),
      () =>
        request(app)
          .put("/api/tax-settings")
          .set("Authorization", adminAuthorization)
          .send({}),
      () =>
        request(app)
          .post("/api/master-data-import/preview")
          .set("Authorization", adminAuthorization),
      () =>
        request(app)
          .post("/api/master-data-import/commit")
          .set("Authorization", adminAuthorization)
          .send({}),
      () =>
        request(app)
          .post("/api/auth/forgot-password")
          .send({ email: "demo.safety.admin@local.test" }),
      () =>
        request(app)
          .post("/api/auth/reset-password")
          .send({
            token: "demo-token",
            password: "ChangedPassword123!",
            password_confirmation: "ChangedPassword123!",
          }),
      () =>
        request(app)
          .post("/api/auth/activate-account")
          .send({
            token: "demo-token",
            password: "ChangedPassword123!",
            password_confirmation: "ChangedPassword123!",
          }),
    ];

    for (const makeRequest of blockedRequests) {
      response = await makeRequest();
      assert.equal(response.status, 403);
      assert.equal(response.body.success, false);
      assert.match(response.body.message, /mode demo publik/i);
    }
  },
);
