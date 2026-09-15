const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../src/app");
const pool = require("../src/config/database");

test("GET / returns API health response", async () => {
  const response = await request(app).get("/");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    message: "Supplier Management API is running",
  });
});

test("GET /health returns liveness without checking dependencies", async () => {
  const response = await request(app).get("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    success: true,
    status: "ok",
  });
});

test("GET /ready returns ready when PostgreSQL is reachable", async (t) => {
  const originalQuery = pool.query;
  pool.query = async () => ({ rows: [{ "?column?": 1 }] });
  t.after(() => {
    pool.query = originalQuery;
  });

  const response = await request(app).get("/ready");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    success: true,
    status: "ready",
    dependencies: {
      database: "up",
    },
  });
});

test("GET /ready returns 503 when PostgreSQL is unavailable", async (t) => {
  const originalQuery = pool.query;
  const originalLogLevel = process.env.LOG_LEVEL;
  pool.query = async () => {
    throw new Error("database unavailable");
  };
  process.env.LOG_LEVEL = "silent";

  t.after(() => {
    pool.query = originalQuery;
    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalLogLevel;
    }
  });

  const response = await request(app).get("/ready");

  assert.equal(response.status, 503);
  assert.deepEqual(response.body, {
    success: false,
    status: "not_ready",
    dependencies: {
      database: "down",
    },
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
      message: "Token autentikasi wajib tersedia.",
    });
  }
);
