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
const { removeAvatar } = require("../src/services/userAvatarService");

const usernames = [
  "avatar_self_sales",
  "avatar_self_finance",
];
const salesPassword = `Sales-${randomBytes(16).toString("hex")}`;
const financePassword = `Finance-${randomBytes(16).toString("hex")}`;

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZJ3sAAAAASUVORK5CYII=",
  "base64",
);

const login = (identifier, password) =>
  request(app)
    .post("/api/auth/login")
    .send({ identifier, password });

before(async () => {
  await pool.query(
    `DELETE FROM app.users WHERE username = ANY($1::VARCHAR[])`,
    [usernames],
  );

  const [salesHash, financeHash] = await Promise.all([
    bcrypt.hash(salesPassword, 8),
    bcrypt.hash(financePassword, 8),
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
      ($1, 'Avatar Self Sales', 'avatar.self.sales@local.test', $2, 'SALES', 'ACTIVE'),
      ($3, 'Avatar Self Finance', 'avatar.self.finance@local.test', $4, 'FINANCE', 'ACTIVE')
    `,
    [usernames[0], salesHash, usernames[1], financeHash],
  );
});

after(async () => {
  const avatars = await pool.query(
    `SELECT avatar_storage_name FROM app.users WHERE username = ANY($1::VARCHAR[])`,
    [usernames],
  );

  for (const row of avatars.rows) {
    await removeAvatar(row.avatar_storage_name).catch(() => {});
  }

  await pool.query(
    `DELETE FROM app.users WHERE username = ANY($1::VARCHAR[])`,
    [usernames],
  );
  await pool.end();
});

test("authenticated users can manage only their own profile avatar", async () => {
  const salesLogin = await login(usernames[0], salesPassword);
  const financeLogin = await login(usernames[1], financePassword);

  assert.equal(salesLogin.status, 200);
  assert.equal(financeLogin.status, 200);

  const salesId = salesLogin.body.data.user.id;
  const financeId = financeLogin.body.data.user.id;
  const salesAuthorization = `Bearer ${salesLogin.body.data.access_token}`;

  let response = await request(app)
    .put(`/api/users/${salesId}/avatar`)
    .set("Authorization", salesAuthorization)
    .attach("avatar", tinyPng, {
      filename: "profile.png",
      contentType: "image/png",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.has_avatar, true);

  response = await request(app)
    .get(`/api/users/${salesId}/avatar`)
    .set("Authorization", salesAuthorization);

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"], /^image\/png/);

  response = await request(app)
    .put(`/api/users/${financeId}/avatar`)
    .set("Authorization", salesAuthorization)
    .attach("avatar", tinyPng, {
      filename: "other-user.png",
      contentType: "image/png",
    });

  assert.equal(response.status, 403);

  response = await request(app)
    .delete(`/api/users/${financeId}/avatar`)
    .set("Authorization", salesAuthorization);

  assert.equal(response.status, 403);

  response = await request(app)
    .delete(`/api/users/${salesId}/avatar`)
    .set("Authorization", salesAuthorization);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.has_avatar, false);

  response = await request(app)
    .get(`/api/users/${salesId}/avatar`)
    .set("Authorization", salesAuthorization);

  assert.equal(response.status, 404);
});
