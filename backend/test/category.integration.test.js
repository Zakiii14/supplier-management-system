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
    username: `category_admin_${suffix.toLowerCase()}`,
    email:
        `category.${suffix.toLowerCase()}@local.test`,
    primaryCode: `CAT-CASE-${suffix}`,
    secondaryCode: `CAT-SECOND-${suffix}`,
    primaryName: `Category Primary ${suffix}`,
    secondaryName: `Category Secondary ${suffix}`,
};

const password =
    `Category-${randomBytes(16).toString("hex")}`;

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
      'Category Test Admin',
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
      DELETE FROM app.categories
      WHERE UPPER(category_code) =
        ANY($1::VARCHAR[])
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
    "category code is uppercase and case-insensitively unique",
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
            .post("/api/categories")
            .set("Authorization", authorization)
            .send({
                category_code:
                    testData.primaryCode.toLowerCase(),
                category_name: `  ${testData.primaryName}  `,
            });

        assert.equal(response.status, 201);
        assert.equal(
            response.body.data.category_code,
            testData.primaryCode,
        );
        assert.equal(
            response.body.data.category_name,
            testData.primaryName,
        );

        response = await request(app)
            .post("/api/categories")
            .set("Authorization", authorization)
            .send({
                category_code:
                    testData.primaryCode.toLowerCase(),
                category_name: `Duplicate ${suffix}`,
            });

        assert.equal(response.status, 409);
        assert.equal(
            response.body.message,
            "Category code or name already exists",
        );

        response = await request(app)
            .post("/api/categories")
            .set("Authorization", authorization)
            .send({
                category_code: testData.secondaryCode,
                category_name: testData.secondaryName,
            });

        assert.equal(response.status, 201);

        const secondaryCategoryId =
            response.body.data.id;

        response = await request(app)
            .patch(
                `/api/categories/${secondaryCategoryId}/status`,
            )
            .set("Authorization", authorization)
            .send({
                status: "INACTIVE",
            });

        assert.equal(response.status, 200);
        assert.equal(
            response.body.data.status,
            "INACTIVE",
        );

        response = await request(app)
            .get("/api/categories")
            .query({
                search: testData.secondaryCode,
                status: "INACTIVE",
                page: 1,
                limit: 5,
            })
            .set("Authorization", authorization);

        assert.equal(response.status, 200);
        assert.equal(response.body.data.length, 1);
        assert.equal(
            response.body.data[0].category_code,
            testData.secondaryCode,
        );
        assert.equal(
            response.body.data[0].status,
            "INACTIVE",
        );
        assert.equal(
            response.body.pagination.page,
            1,
        );
        assert.equal(
            response.body.pagination.limit,
            5,
        );
        assert.equal(
            response.body.pagination.total,
            1,
        );
        assert.equal(
            response.body.pagination.total_pages,
            1,
        );

        response = await request(app)
            .get("/api/categories")
            .query({
                page: 0,
                limit: 101,
            })
            .set("Authorization", authorization);

        assert.equal(response.status, 400);
        assert.equal(
            response.body.message,
            "Invalid pagination parameters",
        );

        response = await request(app)
            .put(
                `/api/categories/${secondaryCategoryId}`,
            )
            .set("Authorization", authorization)
            .send({
                category_code:
                    testData.primaryCode.toLowerCase(),
                category_name: testData.secondaryName,
            });

        assert.equal(response.status, 409);
        assert.equal(
            response.body.message,
            "Category code or name already exists",
        );

        response = await request(app)
            .post("/api/categories")
            .set("Authorization", authorization)
            .send({
                category_code: "   ",
                category_name: "   ",
            });

        assert.equal(response.status, 400);
    },
);