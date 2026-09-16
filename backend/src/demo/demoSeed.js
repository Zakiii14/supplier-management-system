const bcrypt = require("bcryptjs");

const DEMO_IDS = Object.freeze({
  users: {
    admin: "00000000-0000-4000-8000-000000000001",
    purchasing: "00000000-0000-4000-8000-000000000002",
    warehouse: "00000000-0000-4000-8000-000000000003",
    sales: "00000000-0000-4000-8000-000000000004",
    finance: "00000000-0000-4000-8000-000000000005",
    manager: "00000000-0000-4000-8000-000000000006",
  },
  suppliers: {
    packaging: "10000000-0000-4000-8000-000000000001",
    office: "10000000-0000-4000-8000-000000000002",
    electronics: "10000000-0000-4000-8000-000000000003",
  },
  categories: {
    packaging: "20000000-0000-4000-8000-000000000001",
    office: "20000000-0000-4000-8000-000000000002",
    electronics: "20000000-0000-4000-8000-000000000003",
  },
  products: {
    bag: "30000000-0000-4000-8000-000000000001",
    thermalPaper: "30000000-0000-4000-8000-000000000002",
    label: "30000000-0000-4000-8000-000000000003",
    scanner: "30000000-0000-4000-8000-000000000004",
    carton: "30000000-0000-4000-8000-000000000005",
  },
  customers: {
    retail: "40000000-0000-4000-8000-000000000001",
    coffee: "40000000-0000-4000-8000-000000000002",
    corporate: "40000000-0000-4000-8000-000000000003",
  },
  purchaseOrders: {
    ready: "50000000-0000-4000-8000-000000000001",
    draft: "50000000-0000-4000-8000-000000000002",
  },
  salesOrders: {
    ready: "60000000-0000-4000-8000-000000000001",
    invoiced: "60000000-0000-4000-8000-000000000002",
  },
  invoices: {
    partial: "70000000-0000-4000-8000-000000000001",
  },
  payments: {
    partial: "71000000-0000-4000-8000-000000000001",
  },
});

const CODE_SETTINGS = [
  ["SUPPLIER", "Supplier", "supplier_code", true, "SUP", "-", 4, false, false, "NEVER"],
  ["CATEGORY", "Kategori", "category_code", true, "CAT", "-", 4, false, false, "NEVER"],
  ["PRODUCT", "Produk", "sku", true, "SKU", "-", 5, false, false, "NEVER"],
  ["PURCHASE_ORDER", "Purchase Order", "po_number", true, "PO", "-", 4, true, false, "YEARLY"],
  ["GOODS_RECEIPT", "Goods Receipt", "receipt_number", true, "GR", "-", 4, true, false, "YEARLY"],
  ["CUSTOMER", "Pelanggan", "customer_code", true, "CUS", "-", 4, false, false, "NEVER"],
  ["SALES_ORDER", "Sales Order", "so_number", true, "SO", "-", 4, true, false, "YEARLY"],
  ["DELIVERY", "Delivery", "delivery_number", true, "DEL", "-", 4, true, false, "YEARLY"],
  ["INVOICE", "Invoice", "invoice_number", true, "INV", "-", 4, true, false, "YEARLY"],
  ["PAYMENT", "Pembayaran", "payment_number", true, "PAY", "-", 4, true, false, "YEARLY"],
  ["SUPPLIER_PAYMENT", "Pembayaran Supplier", "payment_number", true, "SPAY", "-", 4, true, false, "YEARLY"],
  ["STOCK_OPNAME", "Stock Opname", "opname_number", true, "SOF", "-", 4, true, false, "YEARLY"],
  ["PURCHASE_RETURN", "Retur Pembelian", "return_number", true, "PRT", "-", 4, true, false, "YEARLY"],
  ["SALES_RETURN", "Retur Penjualan", "return_number", true, "SRT", "-", 4, true, false, "YEARLY"],
];

const getPeriod = (resetRule, date = new Date()) => {
  if (resetRule === "YEARLY") return String(date.getUTCFullYear());
  if (resetRule === "MONTHLY") {
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return "GLOBAL";
};

const seedCodeSettings = async (client) => {
  for (const row of CODE_SETTINGS) {
    const [
      moduleKey,
      moduleLabel,
      fieldName,
      isAutomatic,
      prefix,
      separator,
      digitLength,
      includeYear,
      includeMonth,
      resetRule,
    ] = row;

    await client.query(
      `
      INSERT INTO app.code_number_settings (
        module_key,
        module_label,
        field_name,
        is_automatic,
        prefix,
        separator,
        digit_length,
        include_year,
        include_month,
        reset_rule,
        last_number,
        last_period
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11)
      `,
      [
        moduleKey,
        moduleLabel,
        fieldName,
        isAutomatic,
        prefix,
        separator,
        digitLength,
        includeYear,
        includeMonth,
        resetRule,
        getPeriod(resetRule),
      ],
    );
  }
};

const seedUsers = async (client, passwordHash) => {
  const users = [
    [DEMO_IDS.users.admin, "demo_admin", "Demo Administrator", "demo.admin@example.invalid", "ADMIN"],
    [DEMO_IDS.users.purchasing, "demo_purchasing", "Demo Purchasing", "demo.purchasing@example.invalid", "PURCHASING"],
    [DEMO_IDS.users.warehouse, "demo_warehouse", "Demo Warehouse", "demo.warehouse@example.invalid", "WAREHOUSE"],
    [DEMO_IDS.users.sales, "demo_sales", "Demo Sales", "demo.sales@example.invalid", "SALES"],
    [DEMO_IDS.users.finance, "demo_finance", "Demo Finance", "demo.finance@example.invalid", "FINANCE"],
    [DEMO_IDS.users.manager, "demo_manager", "Demo Manager", "demo.manager@example.invalid", "MANAGER"],
  ];

  for (const user of users) {
    await client.query(
      `
      INSERT INTO app.users (
        id, username, full_name, email, password_hash, role, status
      )
      VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE')
      `,
      [...user.slice(0, 4), passwordHash, user[4]],
    );
  }
};

const seedMasterData = async (client) => {
  await client.query(
    `
    INSERT INTO app.suppliers (
      id, supplier_code, supplier_name, contact_person, phone, email,
      address, city, payment_terms_days, payment_scheme, notes
    )
    VALUES
      ($1,'SUP-D001','PT Nusantara Kemasan','Raka Wijaya','021-555-0101','sales@nusantara-kemasan.example.invalid','Jl. Industri Raya No. 18','Jakarta',30,'TERM','Supplier utama kemasan untuk data demo.'),
      ($2,'SUP-D002','CV Sentra Office','Nina Putri','022-555-0112','order@sentra-office.example.invalid','Jl. Asia Afrika No. 80','Bandung',14,'TERM','Supplier perlengkapan operasional.'),
      ($3,'SUP-D003','PT Tekno Retail Indonesia','Bagas Pratama','031-555-0190','b2b@tekno-retail.example.invalid','Jl. Raya Darmo No. 21','Surabaya',30,'TERM','Supplier perangkat barcode dan POS.')
    `,
    [
      DEMO_IDS.suppliers.packaging,
      DEMO_IDS.suppliers.office,
      DEMO_IDS.suppliers.electronics,
    ],
  );

  await client.query(
    `
    INSERT INTO app.categories (id, category_code, category_name)
    VALUES
      ($1,'CAT-D001','Packaging'),
      ($2,'CAT-D002','Office Supplies'),
      ($3,'CAT-D003','Electronics')
    `,
    [
      DEMO_IDS.categories.packaging,
      DEMO_IDS.categories.office,
      DEMO_IDS.categories.electronics,
    ],
  );

  await client.query(
    `
    INSERT INTO app.products (
      id, sku, product_name, category_id, supplier_id, unit,
      purchase_price, selling_price, minimum_stock,
      current_stock, quarantine_stock, damaged_stock
    )
    VALUES
      ($1,'SKU-D0001','Kantong Plastik Eco 30x40',$6,$9,'PACK',18500,25000,20,145,0,3),
      ($2,'SKU-D0002','Thermal Paper 80mm',$7,$10,'ROLL',9500,14000,30,210,0,0),
      ($3,'SKU-D0003','Label Barcode 50x30',$7,$10,'ROLL',32000,45000,15,84,5,0),
      ($4,'SKU-D0004','Barcode Scanner USB',$8,$11,'UNIT',285000,365000,5,18,0,1),
      ($5,'SKU-D0005','Kardus Packing Medium',$6,$9,'PCS',7200,11000,40,260,0,0)
    `,
    [
      DEMO_IDS.products.bag,
      DEMO_IDS.products.thermalPaper,
      DEMO_IDS.products.label,
      DEMO_IDS.products.scanner,
      DEMO_IDS.products.carton,
      DEMO_IDS.categories.packaging,
      DEMO_IDS.categories.office,
      DEMO_IDS.categories.electronics,
      DEMO_IDS.suppliers.packaging,
      DEMO_IDS.suppliers.office,
      DEMO_IDS.suppliers.electronics,
    ],
  );

  await client.query(
    `
    INSERT INTO app.customers (
      id, customer_code, customer_name, contact_person, phone, email,
      address, city, payment_terms_days, credit_limit, notes
    )
    VALUES
      ($1,'CUS-D001','Toko Maju Bersama','Andi Setiawan','0812-0000-1101','andi@maju-bersama.example.invalid','Jl. Jenderal Sudirman No. 12','Purwokerto',14,15000000,'Customer retail demo.'),
      ($2,'CUS-D002','Kopi Pagi Nusantara','Sarah Amelia','0812-0000-2202','sarah@kopipagi.example.invalid','Jl. Prof. Dr. Suharso No. 7','Purwokerto',7,8000000,'Customer F&B demo.'),
      ($3,'CUS-D003','PT Sukses Distribusi','Dimas Ardi','0812-0000-3303','dimas@sukses-distribusi.example.invalid','Jl. Gatot Subroto No. 41','Semarang',30,50000000,'Customer korporat demo.')
    `,
    [
      DEMO_IDS.customers.retail,
      DEMO_IDS.customers.coffee,
      DEMO_IDS.customers.corporate,
    ],
  );
};

const seedInventory = async (client) => {
  const movements = [
    ["80000000-0000-4000-8000-000000000001", DEMO_IDS.products.bag, 145, "AVAILABLE"],
    ["80000000-0000-4000-8000-000000000002", DEMO_IDS.products.thermalPaper, 210, "AVAILABLE"],
    ["80000000-0000-4000-8000-000000000003", DEMO_IDS.products.label, 84, "AVAILABLE"],
    ["80000000-0000-4000-8000-000000000004", DEMO_IDS.products.scanner, 18, "AVAILABLE"],
    ["80000000-0000-4000-8000-000000000005", DEMO_IDS.products.carton, 260, "AVAILABLE"],
    ["80000000-0000-4000-8000-000000000006", DEMO_IDS.products.label, 5, "QUARANTINE"],
    ["80000000-0000-4000-8000-000000000007", DEMO_IDS.products.bag, 3, "DAMAGED"],
    ["80000000-0000-4000-8000-000000000008", DEMO_IDS.products.scanner, 1, "DAMAGED"],
  ];
  for (const [id, productId, quantity, bucket] of movements) {
    await client.query(
      `
      INSERT INTO app.inventory_movements (
        id, product_id, movement_type, quantity, reference_type,
        stock_bucket, notes, created_by
      )
      VALUES ($1,$2,'ADJUSTMENT_IN',$3,'DEMO_SEED',$4,'Stok awal live demo.',$5)
      `,
      [id, productId, quantity, bucket, DEMO_IDS.users.warehouse],
    );
  }
};

const seedPurchasing = async (client) => {
  await client.query(
    `
    INSERT INTO app.purchase_orders (
      id, po_number, supplier_id, order_date, expected_date, status,
      payment_scheme, payment_terms_days, down_payment_percent, notes,
      created_by, approval_status, submitted_by, submitted_at, decided_by, decided_at
    )
    VALUES
      ($1,'DEMO-PO-001', $3, CURRENT_DATE - 2, CURRENT_DATE + 5, 'SUBMITTED',
       'TERM',30,0,'PO demo sudah disetujui dan siap diterima Warehouse.',
       $5,'APPROVED',$5,NOW()-INTERVAL '2 days',$6,NOW()-INTERVAL '1 day'),
      ($2,'DEMO-PO-002', $4, CURRENT_DATE, CURRENT_DATE + 7, 'DRAFT',
       'TERM',14,0,'PO draft untuk dicoba oleh Purchasing.',
       $5,'DRAFT',NULL,NULL,NULL,NULL)
    `,
    [
      DEMO_IDS.purchaseOrders.ready,
      DEMO_IDS.purchaseOrders.draft,
      DEMO_IDS.suppliers.packaging,
      DEMO_IDS.suppliers.office,
      DEMO_IDS.users.purchasing,
      DEMO_IDS.users.manager,
    ],
  );

  await client.query(
    `
    INSERT INTO app.purchase_order_items (
      id, purchase_order_id, product_id, quantity, unit_price
    )
    VALUES
      ('51000000-0000-4000-8000-000000000001',$1,$3,50,18500),
      ('51000000-0000-4000-8000-000000000002',$1,$4,100,7200),
      ('51000000-0000-4000-8000-000000000003',$2,$5,40,9500)
    `,
    [
      DEMO_IDS.purchaseOrders.ready,
      DEMO_IDS.purchaseOrders.draft,
      DEMO_IDS.products.bag,
      DEMO_IDS.products.carton,
      DEMO_IDS.products.thermalPaper,
    ],
  );
};

const seedSalesAndFinance = async (client) => {
  await client.query(
    `
    INSERT INTO app.sales_orders (
      id, so_number, customer_id, order_date, requested_delivery_date,
      status, notes, created_by, approval_status,
      submitted_by, submitted_at, decided_by, decided_at
    )
    VALUES
      ($1,'DEMO-SO-001',$3,CURRENT_DATE - 1,CURRENT_DATE + 2,
       'CONFIRMED','SO demo siap diproses Delivery.',$5,'APPROVED',
       $5,NOW()-INTERVAL '1 day',$6,NOW()-INTERVAL '12 hours'),
      ($2,'DEMO-SO-002',$4,CURRENT_DATE - 12,CURRENT_DATE - 8,
       'DELIVERED','SO historis untuk laporan dan contoh invoice.',$5,'APPROVED',
       $5,NOW()-INTERVAL '12 days',$6,NOW()-INTERVAL '11 days')
    `,
    [
      DEMO_IDS.salesOrders.ready,
      DEMO_IDS.salesOrders.invoiced,
      DEMO_IDS.customers.retail,
      DEMO_IDS.customers.corporate,
      DEMO_IDS.users.sales,
      DEMO_IDS.users.manager,
    ],
  );

  await client.query(
    `
    INSERT INTO app.sales_order_items (
      id, sales_order_id, product_id, quantity, unit_price
    )
    VALUES
      ('61000000-0000-4000-8000-000000000001',$1,$3,8,365000),
      ('61000000-0000-4000-8000-000000000002',$1,$4,20,14000),
      ('61000000-0000-4000-8000-000000000003',$2,$5,60,25000),
      ('61000000-0000-4000-8000-000000000004',$2,$6,80,11000)
    `,
    [
      DEMO_IDS.salesOrders.ready,
      DEMO_IDS.salesOrders.invoiced,
      DEMO_IDS.products.scanner,
      DEMO_IDS.products.thermalPaper,
      DEMO_IDS.products.bag,
      DEMO_IDS.products.carton,
    ],
  );

  await client.query(
    `
    INSERT INTO app.invoices (
      id, invoice_number, sales_order_id, customer_id, invoice_date, due_date,
      subtotal, discount_amount, tax_amount, grand_total, paid_amount, status, notes
    )
    VALUES (
      $1,'DEMO-INV-001',$2,$3,CURRENT_DATE - 8,CURRENT_DATE + 6,
      2380000,0,261800,2641800,1000000,'PARTIAL',
      'Invoice demo dengan pembayaran sebagian.'
    )
    `,
    [
      DEMO_IDS.invoices.partial,
      DEMO_IDS.salesOrders.invoiced,
      DEMO_IDS.customers.corporate,
    ],
  );

  await client.query(
    `
    INSERT INTO app.payments (
      id, payment_number, invoice_id, payment_date, amount, method,
      reference_number, notes, received_by
    )
    VALUES (
      $1,'DEMO-PAY-001',$2,CURRENT_DATE - 4,1000000,'BANK_TRANSFER',
      'TRX-DEMO-001','Pembayaran sebagian untuk data demo.',$3
    )
    `,
    [
      DEMO_IDS.payments.partial,
      DEMO_IDS.invoices.partial,
      DEMO_IDS.users.finance,
    ],
  );
};

const seedDemoDatabase = async (client, { password }) => {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("DEMO_ACCOUNT_PASSWORD must contain at least 8 characters");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await seedCodeSettings(client);
  await client.query(
    `
    INSERT INTO app.payment_settings (
      id, default_purchase_scheme, default_purchase_term_days,
      default_down_payment_percent, require_purchase_transfer_proof,
      require_sales_transfer_proof
    )
    VALUES (1,'TERM',30,30,false,false)
    `,
  );
  await client.query(
    `
    INSERT INTO app.tax_settings (
      id, is_enabled, tax_name, default_rate, allow_invoice_override
    )
    VALUES (1,true,'PPN',11.00,true)
    `,
  );

  await seedUsers(client, passwordHash);
  await seedMasterData(client);
  await seedInventory(client);
  await seedPurchasing(client);
  await seedSalesAndFinance(client);

  return {
    accounts: 6,
    suppliers: 3,
    categories: 3,
    products: 5,
    customers: 3,
    purchaseOrders: 2,
    salesOrders: 2,
    invoices: 1,
    payments: 1,
  };
};

module.exports = {
  CODE_SETTINGS,
  DEMO_IDS,
  getPeriod,
  seedDemoDatabase,
};
