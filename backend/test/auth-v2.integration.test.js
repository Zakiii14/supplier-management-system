const path = require("node:path");
const crypto = require("node:crypto");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env.test"),
  override: true,
});

if (process.env.DB_NAME !== "supplier_management_test") {
  throw new Error(
    "Integration tests must use supplier_management_test",
  );
}

process.env.EMAIL_PROVIDER = "console";
process.env.FRONTEND_URL = "http://localhost:5173";

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

const adminUsername = "auth_v2_admin";
const userUsername = "auth_v2_user";
const invitedUsername = "auth_v2_invited";
const adminPassword = "AdminAuthV2-Password";
const userPassword = "UserAuthV2-Password";

const hashRawToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const login = (identifier, password) =>
  request(app)
    .post("/api/auth/login")
    .send({ identifier, password });

const insertKnownToken = async ({
  userId,
  token,
  type,
  expiresInMinutes = 30,
}) => {
  await pool.query(
    `
    UPDATE app.auth_tokens
    SET used_at = NOW()
    WHERE user_id = $1 AND used_at IS NULL
    `,
    [userId],
  );

  await pool.query(
    `
    INSERT INTO app.auth_tokens (
      user_id,
      token_hash,
      token_type,
      expires_at
    )
    VALUES (
      $1,
      $2,
      $3::app.auth_token_type,
      NOW() + ($4::TEXT || ' minutes')::INTERVAL
    )
    `,
    [userId, hashRawToken(token), type, expiresInMinutes],
  );
};

let adminId;
let userId;

before(async () => {
  await pool.query(
    `
    DELETE FROM app.users
    WHERE username = ANY($1::VARCHAR[])
    `,
    [[adminUsername, userUsername, invitedUsername]],
  );

  const [adminHash, userHash] = await Promise.all([
    bcrypt.hash(adminPassword, 8),
    bcrypt.hash(userPassword, 8),
  ]);

  const result = await pool.query(
    `
    INSERT INTO app.users (
      username,
      full_name,
      email,
      password_hash,
      role,
      status,
      email_verified_at,
      password_changed_at
    )
    VALUES
      ($1, 'Auth V2 Admin', 'auth.v2.admin@local.test', $2, 'ADMIN', 'ACTIVE', NOW(), NOW()),
      ($3, 'Auth V2 User', 'auth.v2.user@local.test', $4, 'SALES', 'ACTIVE', NOW(), NOW())
    RETURNING id, username
    `,
    [adminUsername, adminHash, userUsername, userHash],
  );

  adminId = result.rows.find(
    (row) => row.username === adminUsername,
  ).id;
  userId = result.rows.find(
    (row) => row.username === userUsername,
  ).id;
});

after(async () => {
  await pool.query(
    `
    DELETE FROM app.users
    WHERE username = ANY($1::VARCHAR[])
    `,
    [[adminUsername, userUsername, invitedUsername]],
  );

  await pool.end();
});

test("forgot password does not reveal whether email exists", async () => {
  const existing = await request(app)
    .post("/api/auth/forgot-password")
    .send({ email: "auth.v2.user@local.test" });

  const missing = await request(app)
    .post("/api/auth/forgot-password")
    .send({ email: "missing.auth.v2@local.test" });

  assert.equal(existing.status, 200);
  assert.equal(missing.status, 200);
  assert.equal(existing.body.message, missing.body.message);

  const tokenResult = await pool.query(
    `
    SELECT COUNT(*)::INTEGER AS total
    FROM app.auth_tokens
    WHERE user_id = $1
      AND token_type = 'PASSWORD_RESET'
      AND used_at IS NULL
      AND expires_at > NOW()
    `,
    [userId],
  );

  assert.equal(tokenResult.rows[0].total, 1);
});

test("password reset token changes password and cannot be reused", async () => {
  const rawToken = "known-password-reset-token-auth-v2";
  const newPassword = "ChangedAuthV2-Password";

  await insertKnownToken({
    userId,
    token: rawToken,
    type: "PASSWORD_RESET",
  });

  const validateResponse = await request(app)
    .get("/api/auth/reset-password/validate")
    .query({ token: rawToken });

  assert.equal(validateResponse.status, 200);

  const resetResponse = await request(app)
    .post("/api/auth/reset-password")
    .send({
      token: rawToken,
      password: newPassword,
      password_confirmation: newPassword,
    });

  assert.equal(resetResponse.status, 200);

  const loginResponse = await login(userUsername, newPassword);
  assert.equal(loginResponse.status, 200);

  const reuseResponse = await request(app)
    .post("/api/auth/reset-password")
    .send({
      token: rawToken,
      password: "AnotherAuthV2-Password",
      password_confirmation: "AnotherAuthV2-Password",
    });

  assert.equal(reuseResponse.status, 400);
});

test("admin invitation creates inactive passwordless account", async () => {
  const adminLogin = await login(adminUsername, adminPassword);
  assert.equal(adminLogin.status, 200);

  const response = await request(app)
    .post("/api/users/invite")
    .set(
      "Authorization",
      `Bearer ${adminLogin.body.data.access_token}`,
    )
    .send({
      username: invitedUsername,
      full_name: "Invited Auth V2 User",
      email: "auth.v2.invited@local.test",
      role: "WAREHOUSE",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.status, "INACTIVE");

  const dbResult = await pool.query(
    `
    SELECT id, password_hash, email_verified_at
    FROM app.users
    WHERE username = $1
    `,
    [invitedUsername],
  );

  assert.equal(dbResult.rows[0].password_hash, null);
  assert.equal(dbResult.rows[0].email_verified_at, null);
});

test("activation token verifies email, sets password, and activates account", async () => {
  const userResult = await pool.query(
    "SELECT id FROM app.users WHERE username = $1",
    [invitedUsername],
  );
  const invitedUserId = userResult.rows[0].id;
  const rawToken = "known-account-activation-token-auth-v2";
  const password = "InvitedAuthV2-Password";

  await insertKnownToken({
    userId: invitedUserId,
    token: rawToken,
    type: "ACCOUNT_ACTIVATION",
    expiresInMinutes: 1440,
  });

  const validateResponse = await request(app)
    .get("/api/auth/activate-account/validate")
    .query({ token: rawToken });

  assert.equal(validateResponse.status, 200);
  assert.equal(
    validateResponse.body.data.username,
    invitedUsername,
  );

  const activateResponse = await request(app)
    .post("/api/auth/activate-account")
    .send({
      token: rawToken,
      password,
      password_confirmation: password,
    });

  assert.equal(activateResponse.status, 200);

  const loginResponse = await login(invitedUsername, password);
  assert.equal(loginResponse.status, 200);

  const dbResult = await pool.query(
    `
    SELECT status, email_verified_at, password_changed_at
    FROM app.users
    WHERE id = $1
    `,
    [invitedUserId],
  );

  assert.equal(dbResult.rows[0].status, "ACTIVE");
  assert.ok(dbResult.rows[0].email_verified_at);
  assert.ok(dbResult.rows[0].password_changed_at);
});
