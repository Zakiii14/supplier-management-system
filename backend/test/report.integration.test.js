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
const {
  strFromU8,
  unzipSync,
} = require("fflate");

const pool = require("../src/config/database");
const app = require("../src/app");

const testData = {
  adminUsername: "report_admin",
  salesUsername: "report_sales",
  financeUsername: "report_finance",
  warehouseUsername: "report_warehouse",
  supplierCode: "RPT-SUP",
  categoryCode: "RPT-CAT",
  productSku: "RPT-SKU",
  customerCode: "RPT-CUS",
  purchaseOrderNumber: "RPT-PO-0001",
  goodsReceiptNumber: "RPT-GR-0001",
  purchaseReturnNumber: "RPT-PR-0001",
  salesOrderNumber: "RPT-SO-0001",
  deliveryNumber: "RPT-DEL-0001",
  salesReturnNumber: "RPT-SR-0001",
  stockOpnameNumber: "RPT-SOF-0001",
  stockInspectionNumber: "RPT-INS-0001",
  damageResolutionNumber: "RPT-RES-0001",
  invoiceNumber: "RPT-INV-0001",
  paymentNumber: "RPT-PAY-0001",
  supplierPaymentNumber: "RPT-SPAY-0001",
  supplierInvoiceNumber: "RPT-SINV-0001",
};

const testPassword =
  `Reports-${randomBytes(16).toString("hex")}`;

const login = (identifier) =>
  request(app)
    .post("/api/auth/login")
    .send({
      identifier,
      password: testPassword,
    });

const cleanupTestData = async () => {
  await pool.query(
    `DELETE FROM app.sales_return_settlements
     WHERE sales_return_id IN (
       SELECT id FROM app.sales_returns
       WHERE return_number = $1
     )`,
    [testData.salesReturnNumber],
  );

  await pool.query(
    `DELETE FROM app.sales_return_items
     WHERE sales_return_id IN (
       SELECT id FROM app.sales_returns
       WHERE return_number = $1
     )`,
    [testData.salesReturnNumber],
  );

  await pool.query(
    `DELETE FROM app.sales_returns
     WHERE return_number = $1`,
    [testData.salesReturnNumber],
  );

  await pool.query(
    `DELETE FROM app.purchase_return_settlements
     WHERE purchase_return_id IN (
       SELECT id FROM app.purchase_returns
       WHERE return_number = $1
     )`,
    [testData.purchaseReturnNumber],
  );

  await pool.query(
    `DELETE FROM app.purchase_return_items
     WHERE purchase_return_id IN (
       SELECT id FROM app.purchase_returns
       WHERE return_number = $1
     )`,
    [testData.purchaseReturnNumber],
  );

  await pool.query(
    `DELETE FROM app.purchase_returns
     WHERE return_number = $1`,
    [testData.purchaseReturnNumber],
  );

  await pool.query(
    `
    DELETE FROM app.supplier_payments
    WHERE payment_number = $1
    `,
    [testData.supplierPaymentNumber],
  );

  await pool.query(
    `DELETE FROM app.supplier_invoices WHERE invoice_number = $1`,
    [testData.supplierInvoiceNumber],
  );

  await pool.query(
    `
    DELETE FROM app.payments
    WHERE payment_number = $1
    `,
    [testData.paymentNumber],
  );

  await pool.query(
    `
    DELETE FROM app.invoices
    WHERE invoice_number = $1
    `,
    [testData.invoiceNumber],
  );

  await pool.query(
    `
    DELETE FROM app.delivery_items
    WHERE delivery_id IN (
      SELECT id
      FROM app.deliveries
      WHERE delivery_number = $1
    )
    `,
    [testData.deliveryNumber],
  );

  await pool.query(
    `
    DELETE FROM app.deliveries
    WHERE delivery_number = $1
    `,
    [testData.deliveryNumber],
  );

  await pool.query(
    `
    DELETE FROM app.sales_order_items
    WHERE sales_order_id IN (
      SELECT id
      FROM app.sales_orders
      WHERE so_number = $1
    )
    `,
    [testData.salesOrderNumber],
  );

  await pool.query(
    `
    DELETE FROM app.sales_orders
    WHERE so_number = $1
    `,
    [testData.salesOrderNumber],
  );

  await pool.query(
    `
    DELETE FROM app.inventory_movements
    WHERE product_id IN (
      SELECT id
      FROM app.products
      WHERE sku = $1
    )
    `,
    [testData.productSku],
  );

  await pool.query(
    `DELETE FROM app.stock_opname_items
     WHERE stock_opname_id IN (
       SELECT id FROM app.stock_opnames
       WHERE opname_number = $1
     )`,
    [testData.stockOpnameNumber],
  );

  await pool.query(
    `DELETE FROM app.stock_opnames
     WHERE opname_number = $1`,
    [testData.stockOpnameNumber],
  );

  await pool.query(
    `DELETE FROM app.inventory_stock_inspections
     WHERE inspection_number = $1`,
    [testData.stockInspectionNumber],
  );

  await pool.query(
    `DELETE FROM app.inventory_damage_resolutions
     WHERE resolution_number = $1`,
    [testData.damageResolutionNumber],
  );

  await pool.query(
    `DELETE FROM app.goods_receipt_items
     WHERE goods_receipt_id IN (
       SELECT id FROM app.goods_receipts
       WHERE receipt_number = $1
     )`,
    [testData.goodsReceiptNumber],
  );

  await pool.query(
    `DELETE FROM app.goods_receipts
     WHERE receipt_number = $1`,
    [testData.goodsReceiptNumber],
  );

  await pool.query(
    `
    DELETE FROM app.purchase_order_items
    WHERE purchase_order_id IN (
      SELECT id
      FROM app.purchase_orders
      WHERE po_number = $1
    )
    `,
    [testData.purchaseOrderNumber],
  );

  await pool.query(
    `
    DELETE FROM app.purchase_orders
    WHERE po_number = $1
    `,
    [testData.purchaseOrderNumber],
  );

  await pool.query(
    `
    DELETE FROM app.products
    WHERE sku = $1
    `,
    [testData.productSku],
  );

  await pool.query(
    `
    DELETE FROM app.customers
    WHERE customer_code = $1
    `,
    [testData.customerCode],
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
    WHERE username = ANY($1::VARCHAR[])
    `,
    [[
      testData.adminUsername,
      testData.salesUsername,
      testData.financeUsername,
      testData.warehouseUsername,
    ]],
  );
};

before(async () => {
  await cleanupTestData();

  const passwordHash = await bcrypt.hash(
    testPassword,
    8,
  );

  const userResult = await pool.query(
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
    (
      $1,
      'Report Administrator',
      'report.admin@local.test',
      $5,
      'ADMIN',
      'ACTIVE'
    ),
    (
      $2,
      'Report Sales',
      'report.sales@local.test',
      $5,
      'SALES',
      'ACTIVE'
    ),
    (
      $3,
      'Report Finance',
      'report.finance@local.test',
      $5,
      'FINANCE',
      'ACTIVE'
    ),
    (
      $4,
      'Report Warehouse',
      'report.warehouse@local.test',
      $5,
      'WAREHOUSE',
      'ACTIVE'
    )
  RETURNING id, username
  `,
    [
      testData.adminUsername,
      testData.salesUsername,
      testData.financeUsername,
      testData.warehouseUsername,
      passwordHash,
    ],
  );

  const adminId = userResult.rows.find(
    (user) =>
      user.username === testData.adminUsername,
  ).id;

  const supplierResult = await pool.query(
    `
    INSERT INTO app.suppliers (
      supplier_code,
      supplier_name,
      status
    )
    VALUES ($1, 'Report Supplier', 'ACTIVE')
    RETURNING id
    `,
    [testData.supplierCode],
  );

  const supplierId = supplierResult.rows[0].id;

  const categoryResult = await pool.query(
    `
    INSERT INTO app.categories (
      category_code,
      category_name,
      status
    )
    VALUES ($1, 'Report Category', 'ACTIVE')
    RETURNING id
    `,
    [testData.categoryCode],
  );

  const categoryId = categoryResult.rows[0].id;

  const productResult = await pool.query(
    `
    INSERT INTO app.products (
      sku,
      product_name,
      category_id,
      supplier_id,
      unit,
      purchase_price,
      selling_price,
      minimum_stock,
      current_stock,
      quarantine_stock,
      damaged_stock,
      status
    )
    VALUES (
      $1,
      'Report Product',
      $2,
      $3,
      'PCS',
      10000,
      15000,
      10,
      6,
      2,
      1,
      'ACTIVE'
    )
    RETURNING id
    `,
    [
      testData.productSku,
      categoryId,
      supplierId,
    ],
  );

  const productId = productResult.rows[0].id;

  const purchaseOrderResult = await pool.query(
    `
    INSERT INTO app.purchase_orders (
      po_number,
      supplier_id,
      order_date,
      expected_date,
      status,
      created_by
    )
    VALUES (
      $1,
      $2,
      CURRENT_DATE - 10,
      CURRENT_DATE - 3,
      'PARTIALLY_RECEIVED',
      $3
    )
    RETURNING id
    `,
    [
      testData.purchaseOrderNumber,
      supplierId,
      adminId,
    ],
  );

  const purchaseOrderItemResult = await pool.query(
    `
    INSERT INTO app.purchase_order_items (
      purchase_order_id,
      product_id,
      quantity,
      unit_price,
      received_quantity
    )
    VALUES ($1, $2, 10, 10000, 4)
    RETURNING id
    `,
    [purchaseOrderResult.rows[0].id, productId],
  );

  const goodsReceiptResult = await pool.query(
    `INSERT INTO app.goods_receipts(
       receipt_number,purchase_order_id,received_date,
       received_by
     ) VALUES($1,$2,CURRENT_DATE-6,$3)
     RETURNING id`,
    [
      testData.goodsReceiptNumber,
      purchaseOrderResult.rows[0].id,
      adminId,
    ],
  );

  await pool.query(
    `INSERT INTO app.goods_receipt_items(
       goods_receipt_id,purchase_order_item_id,
       product_id,quantity_received,quantity_damaged
     ) VALUES($1,$2,$3,4,0)`,
    [
      goodsReceiptResult.rows[0].id,
      purchaseOrderItemResult.rows[0].id,
      productId,
    ],
  );

  const purchaseReturnResult = await pool.query(
    `INSERT INTO app.purchase_returns(
       return_number,goods_receipt_id,return_date,
       status,reason,created_by,decided_by,decided_at
     ) VALUES(
       $1,$2,CURRENT_DATE-4,'APPROVED','DAMAGED',
       $3,$3,NOW()
     ) RETURNING id`,
    [
      testData.purchaseReturnNumber,
      goodsReceiptResult.rows[0].id,
      adminId,
    ],
  );

  await pool.query(
    `INSERT INTO app.purchase_return_items(
       purchase_return_id,product_id,quantity,
       unit_price,item_condition
     ) VALUES($1,$2,1,10000,'DAMAGED')`,
    [purchaseReturnResult.rows[0].id, productId],
  );

  const supplierInvoiceResult = await pool.query(
    `INSERT INTO app.supplier_invoices(
       invoice_number,purchase_order_id,invoice_date,due_date,total_amount,created_by
     ) VALUES($1,$2,CURRENT_DATE-5,CURRENT_DATE-3,100000,$3) RETURNING id`,
    [testData.supplierInvoiceNumber, purchaseOrderResult.rows[0].id, adminId],
  );

  await pool.query(
    `INSERT INTO app.purchase_return_settlements(
       purchase_return_id,supplier_invoice_id,
       settlement_type,settlement_date,amount,
       reference_number,created_by
     ) VALUES
       ($1,$2,'INVOICE_DEDUCTION',CURRENT_DATE-3,5000,
        'REPORT-PURCHASE-CREDIT',$3),
       ($1,NULL,'REFUND',CURRENT_DATE-2,3000,
        'REPORT-SUPPLIER-REFUND',$3)`,
    [
      purchaseReturnResult.rows[0].id,
      supplierInvoiceResult.rows[0].id,
      adminId,
    ],
  );

  await pool.query(
    `
    INSERT INTO app.supplier_payments (
      payment_number,
      purchase_order_id,
      payment_date,
      amount,
      method,
      reference_number,
      supplier_invoice_id,
      paid_by
    )
    VALUES (
      $1,
      $2,
      CURRENT_DATE - 4,
      40000,
      'BANK_TRANSFER',
      'REPORT-SUPPLIER-REFERENCE',
      $3,
      $4
    )
    `,
    [
      testData.supplierPaymentNumber,
      purchaseOrderResult.rows[0].id,
      supplierInvoiceResult.rows[0].id,
      adminId,
    ],
  );

  await pool.query(
    `
    INSERT INTO app.inventory_movements (
      product_id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      movement_date,
      notes,
      created_by
    )
    VALUES
      (
        $1,
        'PURCHASE_RECEIPT',
        10,
        'REPORT_TEST',
        $2,
        NOW() - INTERVAL '8 days',
        'Report inbound movement',
        $3
      ),
      (
        $1,
        'SALES_ISSUE',
        4,
        'REPORT_TEST',
        NULL,
        NOW() - INTERVAL '2 days',
        'Report outbound movement',
        $3
      )
    `,
    [
      productId,
      purchaseOrderResult.rows[0].id,
      adminId,
    ],
  );

  const customerResult = await pool.query(
    `
    INSERT INTO app.customers (
      customer_code,
      customer_name,
      status
    )
    VALUES ($1, 'Report Customer', 'ACTIVE')
    RETURNING id
    `,
    [testData.customerCode],
  );

  const customerId = customerResult.rows[0].id;

  const salesOrderResult = await pool.query(
    `
    INSERT INTO app.sales_orders (
      so_number,
      customer_id,
      order_date,
      requested_delivery_date,
      status,
      created_by
    )
    VALUES (
      $1,
      $2,
      CURRENT_DATE - 7,
      CURRENT_DATE - 2,
      'DELIVERED',
      $3
    )
    RETURNING id
    `,
    [
      testData.salesOrderNumber,
      customerId,
      adminId,
    ],
  );

  const salesOrderItemResult = await pool.query(
    `
    INSERT INTO app.sales_order_items (
      sales_order_id,
      product_id,
      quantity,
      unit_price,
      discount_amount
    )
    VALUES ($1, $2, 4, 15000, 0)
    RETURNING id
    `,
    [salesOrderResult.rows[0].id, productId],
  );

  const deliveryResult = await pool.query(
    `
    INSERT INTO app.deliveries (
      delivery_number,
      sales_order_id,
      delivery_date,
      status,
      delivered_at,
      created_by
    )
    VALUES (
      $1,
      $2,
      CURRENT_DATE - 2,
      'DELIVERED',
      NOW() - INTERVAL '2 days',
      $3
    )
    RETURNING id
    `,
    [
      testData.deliveryNumber,
      salesOrderResult.rows[0].id,
      adminId,
    ],
  );

  await pool.query(
    `
    INSERT INTO app.delivery_items (
      delivery_id,
      sales_order_item_id,
      product_id,
      quantity_delivered
    )
    VALUES ($1, $2, $3, 4)
    `,
    [
      deliveryResult.rows[0].id,
      salesOrderItemResult.rows[0].id,
      productId,
    ],
  );

  const salesReturnResult = await pool.query(
    `INSERT INTO app.sales_returns(
       return_number,delivery_id,return_date,status,
       reason,created_by,decided_by,decided_at
     ) VALUES(
       $1,$2,CURRENT_DATE-1,'APPROVED','DAMAGED',
       $3,$3,NOW()
     ) RETURNING id`,
    [
      testData.salesReturnNumber,
      deliveryResult.rows[0].id,
      adminId,
    ],
  );

  await pool.query(
    `INSERT INTO app.sales_return_items(
       sales_return_id,product_id,quantity,
       unit_price,item_condition
     ) VALUES($1,$2,1,15000,'QUARANTINE')`,
    [salesReturnResult.rows[0].id, productId],
  );

  const invoiceResult = await pool.query(
    `
    INSERT INTO app.invoices (
      invoice_number,
      sales_order_id,
      customer_id,
      invoice_date,
      due_date,
      subtotal,
      discount_amount,
      tax_amount,
      grand_total,
      paid_amount,
      credit_amount,
      status
    )
    VALUES (
      $1,
      $2,
      $3,
      CURRENT_DATE - 7,
      CURRENT_DATE - 1,
      60000,
      0,
      5000,
      60000,
      20000,
      5000,
      'PARTIAL'
    )
    RETURNING id
    `,
    [
      testData.invoiceNumber,
      salesOrderResult.rows[0].id,
      customerId,
    ],
  );

  await pool.query(
    `
    INSERT INTO app.payments (
      payment_number,
      invoice_id,
      payment_date,
      amount,
      method,
      reference_number,
      received_by
    )
    VALUES (
      $1,
      $2,
      CURRENT_DATE - 3,
      20000,
      'BANK_TRANSFER',
      'REPORT-REFERENCE',
      $3
    )
    `,
    [
      testData.paymentNumber,
      invoiceResult.rows[0].id,
      adminId,
    ],
  );

  await pool.query(
    `INSERT INTO app.sales_return_settlements(
       sales_return_id,invoice_id,settlement_type,
       settlement_date,amount,reference_number,
       created_by
     ) VALUES
       ($1,$2,'INVOICE_DEDUCTION',CURRENT_DATE-1,5000,
        'REPORT-SALES-CREDIT',$3),
       ($1,NULL,'REFUND',CURRENT_DATE,3000,
        'REPORT-CUSTOMER-REFUND',$3)`,
    [
      salesReturnResult.rows[0].id,
      invoiceResult.rows[0].id,
      adminId,
    ],
  );

  const stockOpnameResult = await pool.query(
    `INSERT INTO app.stock_opnames(
       opname_number,opname_date,status,created_by,
       decided_by,decided_at
     ) VALUES($1,CURRENT_DATE,'APPROVED',$2,$2,NOW())
     RETURNING id`,
    [testData.stockOpnameNumber, adminId],
  );

  await pool.query(
    `INSERT INTO app.stock_opname_items(
       stock_opname_id,product_id,system_quantity,
       counted_quantity
     ) VALUES($1,$2,6,7)`,
    [stockOpnameResult.rows[0].id, productId],
  );

  const inspectionResult = await pool.query(
    `INSERT INTO app.inventory_stock_inspections(
       inspection_number,product_id,target_bucket,
       quantity,inspection_date,created_by
     ) VALUES($1,$2,'AVAILABLE',1,CURRENT_DATE,$3)
     RETURNING id`,
    [testData.stockInspectionNumber, productId, adminId],
  );

  const resolutionResult = await pool.query(
    `INSERT INTO app.inventory_damage_resolutions(
       resolution_number,product_id,resolution_action,
       quantity,resolution_date,created_by
     ) VALUES($1,$2,'DISPOSE',1,CURRENT_DATE,$3)
     RETURNING id`,
    [testData.damageResolutionNumber, productId, adminId],
  );

  await pool.query(
    `INSERT INTO app.inventory_movements(
       product_id,movement_type,quantity,reference_type,
       reference_id,stock_bucket,movement_date,notes,
       created_by
     ) VALUES
       ($1,'RETURN_OUT',1,'PURCHASE_RETURN',$2,'AVAILABLE',
        NOW()-INTERVAL '4 days','Report purchase return',$6),
       ($1,'RETURN_IN',1,'SALES_RETURN',$3,'QUARANTINE',
        NOW()-INTERVAL '1 day','Report sales return',$6),
       ($1,'ADJUSTMENT_IN',1,'STOCK_OPNAME',$4,'AVAILABLE',
        NOW(),'Report stock opname',$6),
       ($1,'ADJUSTMENT_IN',1,'STOCK_INSPECTION',$5,'AVAILABLE',
        NOW(),'Report stock inspection',$6),
       ($1,'ADJUSTMENT_OUT',1,'DAMAGE_RESOLUTION',$7,'DAMAGED',
        NOW(),'Report damage resolution',$6)`,
    [
      productId,
      purchaseReturnResult.rows[0].id,
      salesReturnResult.rows[0].id,
      stockOpnameResult.rows[0].id,
      inspectionResult.rows[0].id,
      adminId,
      resolutionResult.rows[0].id,
    ],
  );
});

after(async () => {
  await cleanupTestData();
  await pool.end();
});

const getAuthorization = async (username) => {
  const response = await login(username);

  assert.equal(response.status, 200);

  return `Bearer ${response.body.data.access_token}`;
};

const assertNumericAtLeast = (value, expected) => {
  const numericValue = Number(value);

  assert.equal(Number.isFinite(numericValue), true);
  assert.equal(numericValue >= expected, true);
};

const assertReportEnvelope = (response) => {
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(
    Number.isNaN(
      Date.parse(response.body.data.generated_at),
    ),
    false,
  );
  assert.equal(
    Array.isArray(response.body.data.trend),
    true,
  );
  assert.equal(
    Array.isArray(response.body.data.rows),
    true,
  );
  assert.equal(response.body.pagination.page, 1);
  assert.equal(response.body.pagination.limit, 10);
};

const binaryParser = (response, callback) => {
  const chunks = [];

  response.on("data", (chunk) => chunks.push(chunk));
  response.on("end", () =>
    callback(null, Buffer.concat(chunks)),
  );
};

test(
  "reports provide filtered aggregates, trends, pagination, validation, and RBAC",
  async () => {
    let response = await request(app).get(
      "/api/reports/purchasing",
    );

    assert.equal(response.status, 401);

    const adminAuthorization =
      await getAuthorization(
        testData.adminUsername,
      );

    response = await request(app)
      .get("/api/reports/purchasing")
      .query({
        search: testData.purchaseOrderNumber,
        status: "PARTIALLY_RECEIVED",
        date_from: "2000-01-01",
        date_to: "2100-01-01",
        page: 1,
        limit: 10,
      })
      .set("Authorization", adminAuthorization);

    assertReportEnvelope(response);
    assert.equal(
      response.body.message,
      "Purchasing report retrieved successfully",
    );
    assert.equal(
      response.body.data.rows.some(
        (row) =>
          row.po_number ===
          testData.purchaseOrderNumber,
      ),
      true,
    );
    assertNumericAtLeast(
      response.body.data.summary
        .total_purchase_value,
      90000,
    );
    assert.equal(
      Number(
        response.body.data.summary
          .returned_purchase_value,
      ),
      10000,
    );
    assert.equal(
      Number(
        response.body.data.summary
          .returned_quantity,
      ),
      1,
    );
    assertNumericAtLeast(
      response.body.data.summary
        .pending_receipt_quantity,
      6,
    );

    response = await request(app)
      .get("/api/reports/purchasing/export")
      .query({
        format: "xlsx",
        search: testData.purchaseOrderNumber,
        status: "PARTIALLY_RECEIVED",
        date_from: "2000-01-01",
        date_to: "2100-01-01",
      })
      .set("Authorization", adminAuthorization)
      .buffer(true)
      .parse(binaryParser);

    assert.equal(response.status, 200);
    assert.match(
      response.headers["content-type"],
      /spreadsheetml\.sheet/,
    );
    assert.match(
      response.headers["content-disposition"],
      /laporan-pembelian-.*\.xlsx/,
    );
    assert.equal(Buffer.isBuffer(response.body), true);
    assert.equal(
      response.body.subarray(0, 2).toString(),
      "PK",
    );

    const purchasingWorkbook = unzipSync(response.body);
    const purchasingWorkbookXml = strFromU8(
      purchasingWorkbook["xl/workbook.xml"],
    );
    const purchasingSummarySheet = strFromU8(
      purchasingWorkbook["xl/worksheets/sheet1.xml"],
    );
    const purchasingTransactionSheet = strFromU8(
      purchasingWorkbook["xl/worksheets/sheet2.xml"],
    );
    const purchasingDetailSheet = strFromU8(
      purchasingWorkbook["xl/worksheets/sheet3.xml"],
    );

    assert.match(purchasingWorkbookXml, /name="Ringkasan"/);
    assert.match(purchasingWorkbookXml, /name="Transaksi"/);
    assert.match(
      purchasingWorkbookXml,
      /name="Rincian Item"/,
    );
    assert.match(purchasingSummarySheet, /Ringkasan/);
    assert.ok(purchasingWorkbook["xl/charts/chart1.xml"]);

    assert.match(
      purchasingTransactionSheet,
      new RegExp(testData.purchaseOrderNumber),
    );
    assert.match(
      purchasingDetailSheet,
      new RegExp(testData.purchaseOrderNumber),
    );
    assert.match(
      purchasingDetailSheet,
      new RegExp(testData.productSku),
    );

    response = await request(app)
      .get("/api/reports/purchasing/export")
      .query({
        format: "pdf",
        search: testData.purchaseOrderNumber,
      })
      .set("Authorization", adminAuthorization)
      .buffer(true)
      .parse(binaryParser);

    assert.equal(response.status, 200);
    assert.match(
      response.headers["content-type"],
      /application\/pdf/,
    );
    assert.equal(
      response.body.subarray(0, 4).toString(),
      "%PDF",
    );
    assert.equal(
      response.body
        .toString("latin1")
        .match(/\/Type\s*\/Page\b/g)?.length,
      1,
    );

    response = await request(app)
      .get("/api/reports/inventory")
      .query({
        search: testData.productSku,
        stock_status: "LOW",
        date_from: "2000-01-01",
        date_to: "2100-01-01",
        page: 1,
        limit: 10,
      })
      .set("Authorization", adminAuthorization);

    assertReportEnvelope(response);
    assert.equal(
      response.body.message,
      "Inventory report retrieved successfully",
    );

    const inventoryRow =
      response.body.data.rows.find(
        (row) => row.sku === testData.productSku,
      );

    assert.ok(inventoryRow);
    assert.equal(inventoryRow.stock_status, "LOW");
    assert.equal(Number(inventoryRow.quarantine_stock), 2);
    assert.equal(Number(inventoryRow.damaged_stock), 1);
    assert.equal(Number(inventoryRow.total_physical_stock), 9);
    assertNumericAtLeast(
      inventoryRow.inbound_quantity,
      10,
    );
    assertNumericAtLeast(
      inventoryRow.outbound_quantity,
      4,
    );

    response = await request(app)
      .get("/api/reports/inventory/export")
      .query({
        format: "xlsx",
        search: testData.productSku,
        stock_status: "DAMAGED",
        date_from: "2000-01-01",
        date_to: "2100-01-01",
      })
      .set("Authorization", adminAuthorization)
      .buffer(true)
      .parse(binaryParser);

    assert.equal(response.status, 200);
    assert.match(
      response.headers["content-disposition"],
      /laporan-persediaan-.*\.xlsx/,
    );
    const inventoryWorkbook = unzipSync(response.body);
    const inventoryWorkbookXml = strFromU8(
      inventoryWorkbook["xl/workbook.xml"],
    );
    assert.match(inventoryWorkbookXml, /name="Produk"/);
    assert.match(inventoryWorkbookXml, /name="Pergerakan Stok"/);
    assert.match(
      strFromU8(inventoryWorkbook["xl/worksheets/sheet2.xml"]),
      new RegExp(testData.productSku),
    );
    assert.match(
      strFromU8(inventoryWorkbook["xl/worksheets/sheet3.xml"]),
      /MOV-/,
    );
    const inventoryDetailSheet = strFromU8(
      inventoryWorkbook["xl/worksheets/sheet3.xml"],
    );
    for (const referenceNumber of [
      testData.purchaseReturnNumber,
      testData.salesReturnNumber,
      testData.stockOpnameNumber,
      testData.stockInspectionNumber,
      testData.damageResolutionNumber,
    ]) {
      assert.match(
        inventoryDetailSheet,
        new RegExp(referenceNumber),
      );
    }
    assert.ok(inventoryWorkbook["xl/charts/chart1.xml"]);

    response = await request(app)
      .get("/api/reports/inventory/export")
      .query({ format: "pdf", search: testData.productSku })
      .set("Authorization", adminAuthorization)
      .buffer(true)
      .parse(binaryParser);
    assert.equal(response.status, 200);
    assert.equal(response.body.subarray(0, 4).toString(), "%PDF");

    response = await request(app)
      .get("/api/reports/sales")
      .query({
        search: testData.salesOrderNumber,
        status: "DELIVERED",
        date_from: "2000-01-01",
        date_to: "2100-01-01",
        page: 1,
        limit: 10,
      })
      .set("Authorization", adminAuthorization);

    assertReportEnvelope(response);
    assert.equal(
      response.body.message,
      "Sales report retrieved successfully",
    );

    const salesRow = response.body.data.rows.find(
      (row) =>
        row.so_number === testData.salesOrderNumber,
    );

    assert.ok(salesRow);
    assert.equal(Number(salesRow.delivered_quantity), 4);
    assert.equal(Number(salesRow.returned_quantity), 1);
    assert.equal(Number(salesRow.net_delivered_quantity), 3);
    assert.equal(Number(salesRow.returned_amount), 15000);
    assert.equal(Number(salesRow.total_amount), 45000);
    assert.equal(
      Number(salesRow.pending_delivery_quantity),
      0,
    );
    assert.equal(
      Number(
        response.body.data.summary.gross_sales_value,
      ),
      60000,
    );
    assert.equal(
      Number(
        response.body.data.summary.total_sales_value,
      ),
      45000,
    );

    response = await request(app)
      .get("/api/reports/sales/export")
      .query({
        format: "xlsx",
        search: testData.salesOrderNumber,
        status: "DELIVERED",
      })
      .set("Authorization", adminAuthorization)
      .buffer(true)
      .parse(binaryParser);

    assert.equal(response.status, 200);
    assert.match(
      response.headers["content-disposition"],
      /laporan-penjualan-.*\.xlsx/,
    );

    const salesWorkbook = unzipSync(response.body);
    const salesTransactionSheet = strFromU8(
      salesWorkbook["xl/worksheets/sheet2.xml"],
    );
    const salesDetailSheet = strFromU8(
      salesWorkbook["xl/worksheets/sheet3.xml"],
    );

    assert.match(
      salesTransactionSheet,
      new RegExp(testData.salesOrderNumber),
    );
    assert.match(
      salesDetailSheet,
      new RegExp(testData.productSku),
    );

    response = await request(app)
      .get("/api/reports/sales/export")
      .query({
        format: "pdf",
        search: testData.salesOrderNumber,
      })
      .set("Authorization", adminAuthorization)
      .buffer(true)
      .parse(binaryParser);

    assert.equal(response.status, 200);
    assert.equal(
      response.body.subarray(0, 4).toString(),
      "%PDF",
    );
    assert.equal(
      response.body
        .toString("latin1")
        .match(/\/Type\s*\/Page\b/g)?.length,
      1,
    );

    response = await request(app)
      .get("/api/reports/finance")
      .query({
        search: testData.invoiceNumber,
        status: "OVERDUE",
        date_from: "2000-01-01",
        date_to: "2100-01-01",
        page: 1,
        limit: 10,
      })
      .set("Authorization", adminAuthorization);

    assertReportEnvelope(response);
    assert.equal(
      response.body.message,
      "Finance report retrieved successfully",
    );

    const financeRow =
      response.body.data.rows.find(
        (row) =>
          row.invoice_number ===
          testData.invoiceNumber,
      );

    assert.ok(financeRow);
    assert.equal(financeRow.status, "OVERDUE");
    assert.equal(
      Number(financeRow.outstanding_amount),
      35000,
    );
    assert.equal(Number(financeRow.tax_amount), 5000);
    assert.equal(Number(financeRow.credit_amount), 5000);
    assert.equal(
      Number(response.body.data.summary.customer_refunds),
      3000,
    );
    assert.equal(
      Number(
        response.body.data.summary
          .net_payments_received,
      ),
      17000,
    );
    assertNumericAtLeast(
      response.body.data.summary.payments_received,
      20000,
    );

    response = await request(app)
      .get("/api/reports/finance/export")
      .query({
        format: "xlsx",
        search: testData.invoiceNumber,
        date_from: "2000-01-01",
        date_to: "2100-01-01",
      })
      .set("Authorization", adminAuthorization)
      .buffer(true)
      .parse(binaryParser);

    assert.equal(response.status, 200);
    assert.match(
      response.headers["content-disposition"],
      /laporan-keuangan-.*\.xlsx/,
    );
    const financeWorkbook = unzipSync(response.body);
    const financeWorkbookXml = strFromU8(
      financeWorkbook["xl/workbook.xml"],
    );
    assert.match(financeWorkbookXml, /name="Invoice"/);
    assert.match(financeWorkbookXml, /name="Pembayaran"/);
    assert.match(
      strFromU8(financeWorkbook["xl/worksheets/sheet2.xml"]),
      new RegExp(testData.invoiceNumber),
    );
    assert.match(
      strFromU8(financeWorkbook["xl/worksheets/sheet3.xml"]),
      new RegExp(testData.paymentNumber),
    );
    assert.ok(financeWorkbook["xl/charts/chart1.xml"]);

    response = await request(app)
      .get("/api/reports/finance/export")
      .query({ format: "pdf", search: testData.invoiceNumber })
      .set("Authorization", adminAuthorization)
      .buffer(true)
      .parse(binaryParser);
    assert.equal(response.status, 200);
    assert.equal(response.body.subarray(0, 4).toString(), "%PDF");

    response = await request(app)
      .get("/api/reports/supplier-finance")
      .query({
        search: testData.purchaseOrderNumber,
        payment_status: "OVERDUE",
        date_from: "2000-01-01",
        date_to: "2100-01-01",
        page: 1,
        limit: 10,
      })
      .set("Authorization", adminAuthorization);

    assertReportEnvelope(response);
    assert.equal(
      response.body.message,
      "Supplier finance report retrieved successfully",
    );
    const supplierFinanceRow = response.body.data.rows.find(
      (row) => row.po_number === testData.purchaseOrderNumber,
    );
    assert.ok(supplierFinanceRow);
    assert.equal(supplierFinanceRow.payment_status, "OVERDUE");
    assert.equal(Number(supplierFinanceRow.total_amount), 95000);
    assert.equal(Number(supplierFinanceRow.paid_amount), 40000);
    assert.equal(Number(supplierFinanceRow.supplier_refunds), 3000);
    assert.equal(Number(supplierFinanceRow.net_supplier_payments), 37000);
    assert.equal(Number(supplierFinanceRow.outstanding_amount), 55000);
    assertNumericAtLeast(
      response.body.data.summary.supplier_payments_made,
      40000,
    );

    response = await request(app)
      .get("/api/reports/supplier-finance/export")
      .query({
        format: "xlsx",
        search: testData.purchaseOrderNumber,
      })
      .set("Authorization", adminAuthorization)
      .buffer(true)
      .parse(binaryParser);

    assert.equal(response.status, 200);
    assert.match(
      response.headers["content-disposition"],
      /laporan-keuangan-pembelian-.*\.xlsx/,
    );
    const supplierFinanceWorkbook = unzipSync(response.body);
    assert.match(
      strFromU8(supplierFinanceWorkbook["xl/workbook.xml"]),
      /name="Utang Supplier"/,
    );
    assert.match(
      strFromU8(supplierFinanceWorkbook["xl/worksheets/sheet3.xml"]),
      new RegExp(testData.supplierPaymentNumber),
    );
    assert.ok(supplierFinanceWorkbook["xl/charts/chart1.xml"]);

    response = await request(app)
      .get("/api/reports/supplier-finance/export")
      .query({ format: "pdf", search: testData.purchaseOrderNumber })
      .set("Authorization", adminAuthorization)
      .buffer(true)
      .parse(binaryParser);
    assert.equal(response.status, 200);
    assert.equal(response.body.subarray(0, 4).toString(), "%PDF");

    response = await request(app)
      .get("/api/reports/purchasing")
      .query({
        date_from: "2026-12-31",
        date_to: "2026-01-01",
      })
      .set("Authorization", adminAuthorization);

    assert.equal(response.status, 400);

    response = await request(app)
      .get("/api/reports/sales")
      .query({ limit: 101 })
      .set("Authorization", adminAuthorization);

    assert.equal(response.status, 400);

    response = await request(app)
      .get("/api/reports/sales/export")
      .query({ format: "docx" })
      .set("Authorization", adminAuthorization);

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Invalid export format. Use xlsx or pdf",
    );

    const salesAuthorization =
      await getAuthorization(
        testData.salesUsername,
      );

    response = await request(app)
      .get("/api/reports/sales")
      .set("Authorization", salesAuthorization);

    assert.equal(response.status, 200);

    for (const reportPath of [
      "purchasing",
      "inventory",
      "finance",
      "supplier-finance",
    ]) {
      response = await request(app)
        .get(`/api/reports/${reportPath}`)
        .set("Authorization", salesAuthorization);

      assert.equal(response.status, 403);
    }

    response = await request(app)
      .get("/api/reports/purchasing/export")
      .query({ format: "xlsx" })
      .set("Authorization", salesAuthorization);

    assert.equal(response.status, 403);

    for (const exportPath of [
      "inventory",
      "finance",
      "supplier-finance",
    ]) {
      response = await request(app)
        .get(`/api/reports/${exportPath}/export`)
        .query({ format: "xlsx" })
        .set("Authorization", salesAuthorization);
      assert.equal(response.status, 403);
    }

    const financeAuthorization =
      await getAuthorization(
        testData.financeUsername,
      );

    response = await request(app)
      .get("/api/reports/finance")
      .set("Authorization", financeAuthorization);

    assert.equal(response.status, 200);
    response = await request(app)
      .get("/api/reports/supplier-finance")
      .set("Authorization", financeAuthorization);

    assert.equal(response.status, 200);
    response = await request(app)
      .get("/api/reports/options/suppliers")
      .set(
        "Authorization",
        financeAuthorization,
      );

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);

    const supplierOption =
      response.body.data.find(
        (option) =>
          option.supplier_code ===
          testData.supplierCode,
      );

    assert.ok(supplierOption);
    assert.deepEqual(
      Object.keys(supplierOption).sort(),
      [
        "id",
        "supplier_code",
        "supplier_name",
      ].sort(),
    );

    response = await request(app)
      .get("/api/reports/options/categories")
      .set("Authorization", adminAuthorization);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);

    const categoryOption =
      response.body.data.find(
        (option) =>
          option.category_code ===
          testData.categoryCode,
      );

    assert.ok(categoryOption);
    assert.deepEqual(
      Object.keys(categoryOption).sort(),
      [
        "id",
        "category_code",
        "category_name",
      ].sort(),
    );

    const warehouseAuthorization =
      await getAuthorization(
        testData.warehouseUsername,
      );

    response = await request(app)
      .get("/api/reports/options/customers")
      .set(
        "Authorization",
        warehouseAuthorization,
      );

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);

    const customerOption =
      response.body.data.find(
        (option) =>
          option.customer_code ===
          testData.customerCode,
      );

    assert.ok(customerOption);
    assert.deepEqual(
      Object.keys(customerOption).sort(),
      [
        "id",
        "customer_code",
        "customer_name",
      ].sort(),
    );

    for (const optionPath of [
      "suppliers",
      "categories",
    ]) {
      response = await request(app)
        .get(
          `/api/reports/options/${optionPath}`,
        )
        .set(
          "Authorization",
          salesAuthorization,
        );

      assert.equal(response.status, 403);
    }
  },

);
