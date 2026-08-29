const pool = require("../config/database");

const SECTION_ROLES = {
  inventory: [
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "SALES",
    "FINANCE",
    "MANAGER",
  ],
  purchasing: [
    "ADMIN",
    "PURCHASING",
    "WAREHOUSE",
    "FINANCE",
    "MANAGER",
  ],
  sales: [
    "ADMIN",
    "WAREHOUSE",
    "SALES",
    "FINANCE",
    "MANAGER",
  ],
  finance: [
    "ADMIN",
    "FINANCE",
    "MANAGER",
  ],
  administration: ["ADMIN"],
};

const ACTIVITY_TYPES = {
  ADMIN: [
    "PURCHASE_ORDER",
    "GOODS_RECEIPT",
    "INVENTORY_MOVEMENT",
    "SALES_ORDER",
    "DELIVERY",
    "INVOICE",
    "PAYMENT",
  ],
  PURCHASING: [
    "PURCHASE_ORDER",
    "GOODS_RECEIPT",
    "INVENTORY_MOVEMENT",
  ],
  WAREHOUSE: [
    "PURCHASE_ORDER",
    "GOODS_RECEIPT",
    "INVENTORY_MOVEMENT",
    "SALES_ORDER",
    "DELIVERY",
  ],
  SALES: [
    "SALES_ORDER",
    "DELIVERY",
    "INVOICE",
  ],
  FINANCE: [
    "PURCHASE_ORDER",
    "GOODS_RECEIPT",
    "INVENTORY_MOVEMENT",
    "SALES_ORDER",
    "INVOICE",
    "PAYMENT",
  ],
  MANAGER: [
    "PURCHASE_ORDER",
    "GOODS_RECEIPT",
    "INVENTORY_MOVEMENT",
    "SALES_ORDER",
    "DELIVERY",
    "INVOICE",
    "PAYMENT",
  ],
};

const hasSectionAccess = (role, section) =>
  SECTION_ROLES[section]?.includes(role) ?? false;

const buildSections = (metrics, role) => {
  const sections = {};

  if (hasSectionAccess(role, "inventory")) {
    sections.inventory = {
      active_products: metrics.active_products,
      low_stock_products:
        metrics.low_stock_products,
      total_stock_units: metrics.total_stock_units,
    };
  }

  if (hasSectionAccess(role, "purchasing")) {
    sections.purchasing = {
      active_suppliers: metrics.active_suppliers,
      open_purchase_orders:
        metrics.open_purchase_orders,
      pending_receipt_quantity:
        metrics.pending_receipt_quantity,
      inventory_value: metrics.inventory_value,
    };
  }

  if (hasSectionAccess(role, "sales")) {
    sections.sales = {
      active_customers: metrics.active_customers,
      open_sales_orders:
        metrics.open_sales_orders,
      pending_deliveries:
        metrics.pending_deliveries,
    };
  }

  if (hasSectionAccess(role, "finance")) {
    sections.finance = {
      outstanding_invoices:
        metrics.outstanding_invoices,
      overdue_invoices: metrics.overdue_invoices,
      outstanding_amount:
        metrics.outstanding_amount,
      payments_this_month:
        metrics.payments_this_month,
      payments_this_month_amount:
        metrics.payments_this_month_amount,
    };
  }

  if (hasSectionAccess(role, "administration")) {
    sections.administration = {
      active_users: metrics.active_users,
    };
  }

  return sections;
};

const getDashboardSummary = async (req, res) => {
  try {
    const role = req.user.role;

    const activityTypes =
      ACTIVITY_TYPES[role] ?? [];

    const metricsQuery = `
      SELECT
        (
          SELECT COUNT(*)::INTEGER
          FROM app.products
          WHERE status = 'ACTIVE'
        ) AS active_products,
        (
          SELECT COUNT(*)::INTEGER
          FROM app.products
          WHERE status = 'ACTIVE'
            AND current_stock <= minimum_stock
        ) AS low_stock_products,
        (
          SELECT COALESCE(
            SUM(current_stock),
            0
          )
          FROM app.products
          WHERE status = 'ACTIVE'
        ) AS total_stock_units,
        (
          SELECT COALESCE(
            SUM(
              current_stock * purchase_price
            ),
            0
          )
          FROM app.products
          WHERE status = 'ACTIVE'
        ) AS inventory_value,
        (
          SELECT COUNT(*)::INTEGER
          FROM app.suppliers
          WHERE status = 'ACTIVE'
        ) AS active_suppliers,
        (
          SELECT COUNT(*)::INTEGER
          FROM app.purchase_orders
          WHERE status IN (
            'DRAFT',
            'SUBMITTED',
            'PARTIALLY_RECEIVED'
          )
        ) AS open_purchase_orders,
        (
          SELECT COALESCE(
            SUM(
              poi.quantity
              - poi.received_quantity
            ),
            0
          )
          FROM app.purchase_order_items poi
          JOIN app.purchase_orders po
            ON po.id = poi.purchase_order_id
          WHERE po.status IN (
            'DRAFT',
            'SUBMITTED',
            'PARTIALLY_RECEIVED'
          )
        ) AS pending_receipt_quantity,
        (
          SELECT COUNT(*)::INTEGER
          FROM app.customers
          WHERE status = 'ACTIVE'
        ) AS active_customers,
        (
          SELECT COUNT(*)::INTEGER
          FROM app.sales_orders
          WHERE status IN (
            'DRAFT',
            'CONFIRMED',
            'PARTIALLY_DELIVERED'
          )
        ) AS open_sales_orders,
        (
          SELECT COUNT(*)::INTEGER
          FROM app.deliveries
          WHERE status IN (
            'PENDING',
            'SHIPPED'
          )
        ) AS pending_deliveries,
        (
          SELECT COUNT(*)::INTEGER
          FROM app.v_outstanding_invoices
        ) AS outstanding_invoices,
        (
          SELECT COUNT(*)::INTEGER
          FROM app.v_outstanding_invoices
          WHERE calculated_status = 'OVERDUE'
        ) AS overdue_invoices,
        (
          SELECT COALESCE(
            SUM(outstanding_amount),
            0
          )
          FROM app.v_outstanding_invoices
        ) AS outstanding_amount,
        (
          SELECT COUNT(*)::INTEGER
          FROM app.payments
          WHERE payment_date >=
            DATE_TRUNC('month', CURRENT_DATE)
          AND payment_date <
            DATE_TRUNC('month', CURRENT_DATE)
            + INTERVAL '1 month'
        ) AS payments_this_month,
        (
          SELECT COALESCE(SUM(amount), 0)
          FROM app.payments
          WHERE payment_date >=
            DATE_TRUNC('month', CURRENT_DATE)
          AND payment_date <
            DATE_TRUNC('month', CURRENT_DATE)
            + INTERVAL '1 month'
        ) AS payments_this_month_amount,
        (
          SELECT COUNT(*)::INTEGER
          FROM app.users
          WHERE status = 'ACTIVE'
        ) AS active_users
    `;

    const lowStockQuery = `
      SELECT
        id,
        sku,
        product_name,
        category_name,
        supplier_name,
        current_stock,
        minimum_stock,
        unit
      FROM app.v_low_stock_products
      ORDER BY
        (
          minimum_stock - current_stock
        ) DESC,
        product_name ASC
      LIMIT 5
    `;

    const overdueInvoiceQuery = `
      SELECT
        id,
        invoice_number,
        customer_id,
        customer_name,
        invoice_date,
        due_date,
        grand_total,
        paid_amount,
        outstanding_amount,
        calculated_status AS status
      FROM app.v_outstanding_invoices
      WHERE calculated_status = 'OVERDUE'
      ORDER BY
        due_date ASC,
        invoice_number ASC
      LIMIT 5
    `;

    const recentActivityQuery = `
      WITH activities AS (
        SELECT
          'PURCHASE_ORDER'::TEXT
            AS activity_type,
          po.id AS entity_id,
          po.po_number::TEXT
            AS reference_number,
          s.supplier_name::TEXT AS subject,
          po.status::TEXT AS status,
          po.created_at AS occurred_at
        FROM app.purchase_orders po
        JOIN app.suppliers s
          ON s.id = po.supplier_id

        UNION ALL

        SELECT
          'GOODS_RECEIPT'::TEXT,
          gr.id,
          gr.receipt_number::TEXT,
          s.supplier_name::TEXT,
          'RECEIVED'::TEXT,
          gr.created_at
        FROM app.goods_receipts gr
        JOIN app.purchase_orders po
          ON po.id = gr.purchase_order_id
        JOIN app.suppliers s
          ON s.id = po.supplier_id

        UNION ALL

        SELECT
          'INVENTORY_MOVEMENT'::TEXT,
          im.id,
          p.sku::TEXT,
          p.product_name::TEXT,
          im.movement_type::TEXT,
          im.movement_date
        FROM app.inventory_movements im
        JOIN app.products p
          ON p.id = im.product_id

        UNION ALL

        SELECT
          'SALES_ORDER'::TEXT,
          so.id,
          so.so_number::TEXT,
          c.customer_name::TEXT,
          so.status::TEXT,
          so.created_at
        FROM app.sales_orders so
        JOIN app.customers c
          ON c.id = so.customer_id

        UNION ALL

        SELECT
          'DELIVERY'::TEXT,
          d.id,
          d.delivery_number::TEXT,
          c.customer_name::TEXT,
          d.status::TEXT,
          d.created_at
        FROM app.deliveries d
        JOIN app.sales_orders so
          ON so.id = d.sales_order_id
        JOIN app.customers c
          ON c.id = so.customer_id

        UNION ALL

        SELECT
          'INVOICE'::TEXT,
          i.id,
          i.invoice_number::TEXT,
          c.customer_name::TEXT,
          CASE
            WHEN
              i.due_date < CURRENT_DATE
              AND i.status IN (
                'UNPAID',
                'PARTIAL'
              )
            THEN 'OVERDUE'::TEXT
            ELSE i.status::TEXT
          END,
          i.created_at
        FROM app.invoices i
        JOIN app.customers c
          ON c.id = i.customer_id

        UNION ALL

        SELECT
          'PAYMENT'::TEXT,
          p.id,
          p.payment_number::TEXT,
          c.customer_name::TEXT,
          p.method::TEXT,
          p.created_at
        FROM app.payments p
        JOIN app.invoices i
          ON i.id = p.invoice_id
        JOIN app.customers c
          ON c.id = i.customer_id
      )
      SELECT
        activity_type,
        entity_id,
        reference_number,
        subject,
        status,
        occurred_at
      FROM activities
      WHERE activity_type = ANY($1::TEXT[])
      ORDER BY occurred_at DESC
      LIMIT 8
    `;

    const includeFinance = hasSectionAccess(
      role,
      "finance",
    );

    const [
      metricsResult,
      lowStockResult,
      overdueInvoiceResult,
      recentActivityResult,
    ] = await Promise.all([
      pool.query(metricsQuery),
      pool.query(lowStockQuery),
      includeFinance
        ? pool.query(overdueInvoiceQuery)
        : Promise.resolve({ rows: [] }),
      pool.query(
        recentActivityQuery,
        [activityTypes],
      ),
    ]);

    const metrics = metricsResult.rows[0];

    const alerts = {
      low_stock_products: lowStockResult.rows,
    };

    if (includeFinance) {
      alerts.overdue_invoices =
        overdueInvoiceResult.rows;
    }

    res.status(200).json({
      success: true,
      message:
        "Dashboard summary retrieved successfully",
      data: {
        generated_at: new Date().toISOString(),
        sections: buildSections(metrics, role),
        alerts,
        recent_activity: recentActivityResult.rows,
      },
    });
  } catch (error) {
    console.error(
      "Error fetching dashboard summary:",
      error,
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve dashboard summary",
    });
  }
};

module.exports = {
  getDashboardSummary,
};
