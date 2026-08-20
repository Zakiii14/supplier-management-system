const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../src/app");

test("GET / returns API health response", async () => {
  const response = await request(app).get("/");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    message: "Supplier Management API is running",
  });
});

test("unknown endpoint returns JSON 404", async () => {
  const response = await request(app).get(
    "/api/tidak-ada"
  );

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    success: false,
    message: "Endpoint not found",
  });
});

test(
  "protected endpoint rejects request without token",
  async () => {
    const response = await request(app).get(
      "/api/products"
    );

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, {
      success: false,
      message: "Authentication token is required",
    });
  }
);