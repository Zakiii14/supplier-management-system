const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const request = require("supertest");

const errorHandler = require("../src/middleware/errorHandler");
const { createGracefulShutdown } = require("../src/server");

const withEnvironment = async (values, callback) => {
  const original = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await callback();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

test("final error handler hides unexpected error details in production", async () => {
  await withEnvironment(
    {
      NODE_ENV: "production",
      LOG_LEVEL: "silent",
    },
    async () => {
      const testApp = express();
      testApp.get("/boom", () => {
        throw new Error("database password leaked here");
      });
      testApp.use(errorHandler);

      const response = await request(testApp).get("/boom");

      assert.equal(response.status, 500);
      assert.deepEqual(response.body, {
        success: false,
        message: "Internal server error",
      });
    },
  );
});

test("final error handler preserves explicit operational error messages", async () => {
  await withEnvironment(
    {
      NODE_ENV: "production",
      LOG_LEVEL: "silent",
    },
    async () => {
      const testApp = express();
      testApp.get("/conflict", () => {
        const error = new Error("Data sudah berubah, muat ulang halaman");
        error.statusCode = 409;
        throw error;
      });
      testApp.use(errorHandler);

      const response = await request(testApp).get("/conflict");

      assert.equal(response.status, 409);
      assert.deepEqual(response.body, {
        success: false,
        message: "Data sudah berubah, muat ulang halaman",
      });
    },
  );
});

test("graceful shutdown closes HTTP server and PostgreSQL pool once", async () => {
  let serverCloseCount = 0;
  let poolEndCount = 0;
  const exitCodes = [];

  const server = {
    close(callback) {
      serverCloseCount += 1;
      callback();
    },
  };
  const databasePool = {
    async end() {
      poolEndCount += 1;
    },
  };

  await withEnvironment({ LOG_LEVEL: "silent" }, async () => {
    const shutdown = createGracefulShutdown({
      server,
      databasePool,
      timeoutMs: 100,
      exit: (code) => {
        exitCodes.push(code);
      },
    });

    await Promise.all([
      shutdown("SIGTERM"),
      shutdown("SIGTERM"),
    ]);
  });

  assert.equal(serverCloseCount, 1);
  assert.equal(poolEndCount, 1);
  assert.deepEqual(exitCodes, [0]);
});
