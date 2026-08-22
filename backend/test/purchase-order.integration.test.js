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
    username: `po_admin_${suffix.toLowerCase()}`,
    email: `po.${suffix.toLowerCase()}@local.test`,
    supplierCode: `PO-SUP-${suffix}`,
    categoryCode: `PO-CAT-${suffix}`,
    sku: `PO-SKU-${suffix}`,
    firstPoNumber: `PO-LIST-A-${suffix}`,
    secondPoNumber: `PO-LIST-B-${suffix}`,
};

const password =
    `PurchaseOrder-${randomBytes(16).toString("hex")}`;

const today = new Date()
    .toISOString()
    .slice(0, 10);

const expectedDate = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
)
    .toISOString()
    .slice(0, 10);

let authorization;
let supplierId;
let productId;

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
      'Purchase Order Test Admin',
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

    let response = await request(app)
        .post("/api/auth/login")
        .send({
            identifier: testData.username,
            password,
        });

    assert.equal(response.status, 200);

    authorization =
        `Bearer ${response.body.data.access_token}`;

    response = await request(app)
        .post("/api/suppliers")
        .set("Authorization", authorization)
        .send({
            supplier_code: testData.supplierCode,
            supplier_name:
                `Purchase Order Supplier ${suffix}`,
            payment_terms_days: 14,
        });

    assert.equal(response.status, 201);
    supplierId = response.body.data.id;

    response = await request(app)
        .post("/api/categories")
        .set("Authorization", authorization)
        .send({
            category_code: testData.categoryCode,
            category_name:
                `Purchase Order Category ${suffix}`,
        });

    assert.equal(response.status, 201);

    const categoryId = response.body.data.id;

    response = await request(app)
        .post("/api/products")
        .set("Authorization", authorization)
        .send({
            sku: testData.sku,
            product_name:
                `Purchase Order Product ${suffix}`,
            category_id: categoryId,
            supplier_id: supplierId,
            unit: "PCS",
            purchase_price: 5000,
            selling_price: 7500,
            minimum_stock: 2,
        });

    assert.equal(response.status, 201);
    productId = response.body.data.id;

    response = await request(app)
        .post("/api/purchase-orders")
        .set("Authorization", authorization)
        .send({
            po_number: testData.firstPoNumber,
            supplier_id: supplierId,
            order_date: today,
            expected_date: expectedDate,
            notes: `First purchase order ${suffix}`,
            items: [
                {
                    product_id: productId,
                    quantity: 2,
                    unit_price: 5000,
                },
            ],
        });

    assert.equal(response.status, 201);

    response = await request(app)
        .post("/api/purchase-orders")
        .set("Authorization", authorization)
        .send({
            po_number: testData.secondPoNumber,
            supplier_id: supplierId,
            order_date: today,
            expected_date: expectedDate,
            notes: `Second purchase order ${suffix}`,
            items: [
                {
                    product_id: productId,
                    quantity: 5,
                    unit_price: 5000,
                },
            ],
        });

    assert.equal(response.status, 201);

    const secondPurchaseOrderId =
        response.body.data.id;

    response = await request(app)
        .patch(
            `/api/purchase-orders/${secondPurchaseOrderId}/status`,
        )
        .set("Authorization", authorization)
        .send({ status: "SUBMITTED" });

    assert.equal(response.status, 200);
});

after(async () => {
    try {
        const poNumbers = [
            testData.firstPoNumber,
            testData.secondPoNumber,
        ];

        await pool.query(
            `
      DELETE FROM app.purchase_order_items
      WHERE purchase_order_id IN (
        SELECT id
        FROM app.purchase_orders
        WHERE po_number = ANY($1::VARCHAR[])
      )
      `,
            [poNumbers],
        );

        await pool.query(
            `
      DELETE FROM app.purchase_orders
      WHERE po_number = ANY($1::VARCHAR[])
      `,
            [poNumbers],
        );

        await pool.query(
            `
      DELETE FROM app.products
      WHERE sku = $1
      `,
            [testData.sku],
        );

        await pool.query(
            `
      DELETE FROM app.categories
      WHERE category_code = $1
      `,
            [testData.categoryCode],
        );

        await pool.query(
            `
      DELETE FROM app.suppliers
      WHERE supplier_code = $1
      `,
            [testData.supplierCode],
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
    "purchase order list supports search, status filter, and pagination",
    async () => {
        const commonSearch = suffix;

        let response = await request(app)
            .get("/api/purchase-orders")
            .query({
                search: commonSearch,
                page: 1,
                limit: 1,
            })
            .set("Authorization", authorization);

        assert.equal(response.status, 200);
        assert.equal(response.body.data.length, 1);
        assert.equal(response.body.pagination.page, 1);
        assert.equal(response.body.pagination.limit, 1);
        assert.equal(response.body.pagination.total, 2);
        assert.equal(
            response.body.pagination.total_pages,
            2,
        );

        response = await request(app)
            .get("/api/purchase-orders")
            .query({
                search: commonSearch,
                page: 2,
                limit: 1,
            })
            .set("Authorization", authorization);

        assert.equal(response.status, 200);
        assert.equal(response.body.data.length, 1);
        assert.equal(response.body.pagination.page, 2);
        assert.equal(response.body.pagination.total, 2);

        response = await request(app)
            .get("/api/purchase-orders")
            .query({
                search: testData.secondPoNumber,
                status: "submitted",
                page: 1,
                limit: 5,
            })
            .set("Authorization", authorization);

        assert.equal(response.status, 200);
        assert.equal(response.body.data.length, 1);
        assert.equal(
            response.body.data[0].po_number,
            testData.secondPoNumber,
        );
        assert.equal(
            response.body.data[0].status,
            "SUBMITTED",
        );
        assert.equal(
            Number(response.body.data[0].total_items),
            1,
        );
        assert.equal(
            Number(response.body.data[0].total_amount),
            25000,
        );

        response = await request(app)
            .get("/api/purchase-orders")
            .query({
                search: testData.supplierCode,
                status: "DRAFT",
            })
            .set("Authorization", authorization);

        assert.equal(response.status, 200);
        assert.equal(response.body.data.length, 1);
        assert.equal(
            response.body.data[0].po_number,
            testData.firstPoNumber,
        );

        response = await request(app)
            .get("/api/purchase-orders")
            .query({ page: 0, limit: 101 })
            .set("Authorization", authorization);

        assert.equal(response.status, 400);
        assert.equal(
            response.body.message,
            "Invalid pagination parameters",
        );

        response = await request(app)
            .get("/api/purchase-orders")
            .query({ status: "UNKNOWN" })
            .set("Authorization", authorization);

        assert.equal(response.status, 400);
        assert.equal(
            response.body.message,
            "Invalid purchase order status",
        );
    },
);