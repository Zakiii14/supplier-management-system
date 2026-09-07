const pool = require("../config/database");
const {
  normalizeEnum,
  normalizeText,
  parseReportQuery,
  validateEnum,
  validateUuid,
} = require("../utils/reportUtils");
const {
  EXCEL_MIME_TYPE,
  PDF_MIME_TYPE,
  buildExportFileName,
  createExcelReport,
  createPdfReport,
  formatStatus,
} = require("../services/reportExportService");

const PURCHASE_ORDER_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
];

const SALES_ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "CANCELLED",
];

const EXPORT_FORMATS = ["xlsx", "pdf"];

const parseExportQuery = (
  query,
  {
    statuses,
    statusErrorMessage,
    entityParam,
    entityLabel,
  },
) => {
  const parsed = parseReportQuery({
    ...query,
    page: "1",
    limit: "100",
  });

  if (parsed.error) {
    return { error: parsed.error };
  }

  const format = normalizeText(query.format)
    .toLocaleLowerCase("id-ID");
  const status = normalizeEnum(query.status);
  const entityId = normalizeText(query[entityParam]);

  if (!EXPORT_FORMATS.includes(format)) {
    return {
      error: "Invalid export format. Use xlsx or pdf",
    };
  }

  const statusError = validateEnum(
    status,
    statuses,
    statusErrorMessage,
  );

  if (statusError) {
    return { error: statusError };
  }

  const entityIdError = validateUuid(
    entityId,
    entityLabel,
  );

  if (entityIdError) {
    return { error: entityIdError };
  }

  return {
    ...parsed,
    format,
    status,
    entityId,
  };
};

const buildFilterSummary = ({
  parsed,
  status,
  entityLabel,
  entityValue,
}) => [
  {
    label: "Pencarian",
    value: parsed.search || "Semua data",
  },
  {
    label: "Status",
    value: status ? formatStatus(status) : "Semua status",
  },
  {
    label: entityLabel,
    value: entityValue || `Semua ${entityLabel.toLowerCase()}`,
  },
  {
    label: "Periode",
    value:
      parsed.dateFrom || parsed.dateTo
        ? `${parsed.dateFrom || "awal"} s.d. ${
          parsed.dateTo || "hari ini"
        }`
        : "Semua tanggal",
  },
];

const sendExport = async ({
  res,
  format,
  reportName,
  title,
  sheetName,
  filters,
  columns,
  rows,
  pdfGroup,
}) => {
  const buffer =
    format === "xlsx"
      ? await createExcelReport({
        title,
        sheetName,
        filters,
        columns,
        rows,
        group: pdfGroup,
      })
      : await createPdfReport({
        title,
        filters,
        rows,
        group: pdfGroup,
      });
  const fileName = buildExportFileName(
    reportName,
    format,
  );

  res
    .status(200)
    .set({
      "Content-Type":
        format === "xlsx"
          ? EXCEL_MIME_TYPE
          : PDF_MIME_TYPE,
      "Content-Disposition":
        `attachment; filename="${fileName}"`,
      "Content-Length": buffer.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    })
    .send(buffer);
};

const exportPurchasingReport = async (req, res) => {
  try {
    const parsed = parseExportQuery(req.query, {
      statuses: PURCHASE_ORDER_STATUSES,
      statusErrorMessage:
        "Invalid purchase order status",
      entityParam: "supplier_id",
      entityLabel: "supplier ID",
    });

    if (parsed.error) {
      return res.status(400).json({
        success: false,
        message: parsed.error,
      });
    }

    const conditions = [];
    const values = [];

    if (parsed.search) {
      values.push(`%${parsed.search}%`);
      conditions.push(`
        (
          po.po_number ILIKE $${values.length}
          OR s.supplier_code ILIKE $${values.length}
          OR s.supplier_name ILIKE $${values.length}
        )
      `);
    }

    if (parsed.status) {
      values.push(parsed.status);
      conditions.push(
        `po.status = $${values.length}`,
      );
    }

    if (parsed.entityId) {
      values.push(parsed.entityId);
      conditions.push(
        `po.supplier_id = $${values.length}`,
      );
    }

    if (parsed.dateFrom) {
      values.push(parsed.dateFrom);
      conditions.push(
        `po.order_date >= $${values.length}::DATE`,
      );
    }

    if (parsed.dateTo) {
      values.push(parsed.dateTo);
      conditions.push(
        `po.order_date <= $${values.length}::DATE`,
      );
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";
    const result = await pool.query(
      `
      SELECT
        po.po_number,
        po.order_date,
        po.expected_date,
        po.status::TEXT AS status,
        po.notes,
        s.supplier_code,
        s.supplier_name,
        p.sku,
        p.product_name,
        p.unit,
        poi.quantity AS ordered_quantity,
        poi.received_quantity,
        GREATEST(
          poi.quantity - poi.received_quantity,
          0
        ) AS pending_quantity,
        poi.unit_price,
        poi.quantity * poi.unit_price
          AS item_subtotal,
        SUM(
          poi.quantity * poi.unit_price
        ) OVER (
          PARTITION BY po.id
        ) AS order_total
      FROM app.purchase_orders po
      JOIN app.suppliers s
        ON s.id = po.supplier_id
      JOIN app.purchase_order_items poi
        ON poi.purchase_order_id = po.id
      JOIN app.products p
        ON p.id = poi.product_id
      ${whereClause}
      ORDER BY
        po.order_date DESC,
        po.po_number DESC,
        p.product_name ASC,
        p.sku ASC
      `,
      values,
    );
    const rows = result.rows;
    const supplierValue = parsed.entityId
      ? rows[0]
        ? `${rows[0].supplier_code} - ${
          rows[0].supplier_name
        }`
        : "Supplier terpilih"
      : "";
    const filters = buildFilterSummary({
      parsed,
      status: parsed.status,
      entityLabel: "Supplier",
      entityValue: supplierValue,
    });
    const columns = [
      {
        key: "po_number",
        label: "Nomor PO",
        width: 18,
      },
      {
        key: "order_date",
        label: "Tanggal pesanan",
        type: "date",
        width: 15,
      },
      { key: "sku", label: "SKU", width: 16 },
      {
        key: "product_name",
        label: "Produk",
        width: 25,
      },
      { key: "unit", label: "Satuan", width: 11 },
      {
        key: "ordered_quantity",
        label: "Dipesan",
        type: "number",
        width: 13,
      },
      {
        key: "received_quantity",
        label: "Diterima",
        type: "number",
        width: 13,
      },
      {
        key: "pending_quantity",
        label: "Tersisa",
        type: "number",
        width: 13,
      },
      {
        key: "unit_price",
        label: "Harga satuan",
        type: "currency",
        width: 17,
      },
      {
        key: "item_subtotal",
        label: "Subtotal item",
        type: "currency",
        width: 18,
      },
    ];

    await sendExport({
      res,
      format: parsed.format,
      reportName: "pembelian",
      title: "Laporan Rincian Pembelian",
      sheetName: "Pembelian",
      filters,
      columns,
      rows,
      pdfGroup: {
        key: "po_number",
        label: "Purchase Order",
        summary: {
          dateKey: "order_date",
          chartTitle: "Tren nilai pembelian aktif",
          metrics: [
            {
              label: "Total PO",
              type: "number",
              value: ({ transactions }) =>
                transactions.length,
            },
            {
              label: "Nilai pembelian aktif",
              type: "currency",
              value: ({ activeTransactions }) =>
                activeTransactions.reduce(
                  (total, { row }) =>
                    total + (Number(row.order_total) || 0),
                  0,
                ),
            },
            {
              label: "Unit dipesan aktif",
              type: "number",
              value: ({ activeRows, sumRows }) =>
                sumRows(activeRows, "ordered_quantity"),
            },
            {
              label: "Unit diterima aktif",
              type: "number",
              value: ({ activeRows, sumRows }) =>
                sumRows(activeRows, "received_quantity"),
            },
          ],
        },
        transactionColumns: [
          {
            key: "po_number",
            label: "Nomor PO",
            width: 19,
          },
          {
            key: "order_date",
            label: "Tanggal",
            type: "date",
            width: 15,
          },
          {
            key: "expected_date",
            label: "Estimasi tiba",
            type: "date",
            width: 15,
          },
          {
            key: "status",
            label: "Status",
            type: "status",
            width: 18,
          },
          {
            key: "supplier_code",
            label: "Kode supplier",
            width: 16,
          },
          {
            key: "supplier_name",
            label: "Supplier",
            width: 25,
          },
          {
            label: "Jenis produk",
            type: "number",
            width: 13,
            value: (_row, { groupRows }) =>
              groupRows.length,
          },
          {
            label: "Dipesan",
            type: "number",
            width: 13,
            value: (_row, { groupRows }) =>
              groupRows.reduce(
                (total, row) =>
                  total + Number(row.ordered_quantity),
                0,
              ),
          },
          {
            label: "Diterima",
            type: "number",
            width: 13,
            value: (_row, { groupRows }) =>
              groupRows.reduce(
                (total, row) =>
                  total + Number(row.received_quantity),
                0,
              ),
          },
          {
            key: "order_total",
            label: "Total PO",
            type: "currency",
            width: 18,
          },
          { key: "notes", label: "Catatan", width: 28 },
        ],
        meta: [
          {
            label: "Tanggal",
            type: "date",
            width: 1,
            value: (row) => row.order_date,
          },
          {
            label: "Supplier",
            width: 2.4,
            value: (row) =>
              `${row.supplier_code} - ${row.supplier_name}`,
          },
          {
            label: "Status",
            type: "status",
            width: 1.2,
            value: (row) => row.status,
          },
          {
            label: "Total",
            type: "currency",
            width: 1.4,
            value: (row) => row.order_total,
          },
        ],
        itemColumns: [
          { key: "sku", label: "SKU", width: 85 },
          {
            key: "product_name",
            label: "Produk",
            width: 190,
          },
          { key: "unit", label: "Satuan", width: 52 },
          {
            key: "ordered_quantity",
            label: "Dipesan",
            type: "number",
            align: "right",
            width: 65,
          },
          {
            key: "received_quantity",
            label: "Diterima",
            type: "number",
            align: "right",
            width: 65,
          },
          {
            key: "pending_quantity",
            label: "Tersisa",
            type: "number",
            align: "right",
            width: 65,
          },
          {
            key: "unit_price",
            label: "Harga satuan",
            type: "currency",
            align: "right",
            width: 90,
          },
          {
            key: "item_subtotal",
            label: "Subtotal",
            type: "currency",
            align: "right",
            width: 100,
          },
        ],
      },
    });
  } catch (error) {
    console.error(
      "Error exporting purchasing report:",
      error,
    );

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to export purchasing report",
      });
    }
  }
};

const exportSalesReport = async (req, res) => {
  try {
    const parsed = parseExportQuery(req.query, {
      statuses: SALES_ORDER_STATUSES,
      statusErrorMessage:
        "Invalid sales order status",
      entityParam: "customer_id",
      entityLabel: "customer ID",
    });

    if (parsed.error) {
      return res.status(400).json({
        success: false,
        message: parsed.error,
      });
    }

    const conditions = [];
    const values = [];

    if (parsed.search) {
      values.push(`%${parsed.search}%`);
      conditions.push(`
        (
          so.so_number ILIKE $${values.length}
          OR c.customer_code ILIKE $${values.length}
          OR c.customer_name ILIKE $${values.length}
        )
      `);
    }

    if (parsed.status) {
      values.push(parsed.status);
      conditions.push(
        `so.status = $${values.length}`,
      );
    }

    if (parsed.entityId) {
      values.push(parsed.entityId);
      conditions.push(
        `so.customer_id = $${values.length}`,
      );
    }

    if (parsed.dateFrom) {
      values.push(parsed.dateFrom);
      conditions.push(
        `so.order_date >= $${values.length}::DATE`,
      );
    }

    if (parsed.dateTo) {
      values.push(parsed.dateTo);
      conditions.push(
        `so.order_date <= $${values.length}::DATE`,
      );
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";
    const result = await pool.query(
      `
      WITH delivered_items AS (
        SELECT
          di.sales_order_item_id,
          COALESCE(
            SUM(di.quantity_delivered) FILTER (
              WHERE d.status = 'DELIVERED'
            ),
            0
          ) AS delivered_quantity
        FROM app.delivery_items di
        JOIN app.deliveries d
          ON d.id = di.delivery_id
        GROUP BY di.sales_order_item_id
      )
      SELECT
        so.so_number,
        so.order_date,
        so.requested_delivery_date,
        so.status::TEXT AS status,
        so.notes,
        c.customer_code,
        c.customer_name,
        p.sku,
        p.product_name,
        p.unit,
        soi.quantity AS ordered_quantity,
        COALESCE(di.delivered_quantity, 0)
          AS delivered_quantity,
        GREATEST(
          soi.quantity
            - COALESCE(di.delivered_quantity, 0),
          0
        ) AS pending_quantity,
        soi.unit_price,
        soi.discount_amount,
        GREATEST(
          soi.quantity * soi.unit_price
            - soi.discount_amount,
          0
        ) AS item_subtotal,
        SUM(
          GREATEST(
            soi.quantity * soi.unit_price
              - soi.discount_amount,
            0
          )
        ) OVER (
          PARTITION BY so.id
        ) AS order_total
      FROM app.sales_orders so
      JOIN app.customers c
        ON c.id = so.customer_id
      JOIN app.sales_order_items soi
        ON soi.sales_order_id = so.id
      JOIN app.products p
        ON p.id = soi.product_id
      LEFT JOIN delivered_items di
        ON di.sales_order_item_id = soi.id
      ${whereClause}
      ORDER BY
        so.order_date DESC,
        so.so_number DESC,
        p.product_name ASC,
        p.sku ASC
      `,
      values,
    );
    const rows = result.rows;
    const customerValue = parsed.entityId
      ? rows[0]
        ? `${rows[0].customer_code} - ${
          rows[0].customer_name
        }`
        : "Pelanggan terpilih"
      : "";
    const filters = buildFilterSummary({
      parsed,
      status: parsed.status,
      entityLabel: "Pelanggan",
      entityValue: customerValue,
    });
    const columns = [
      {
        key: "so_number",
        label: "Nomor SO",
        width: 18,
      },
      {
        key: "order_date",
        label: "Tanggal pesanan",
        type: "date",
        width: 15,
      },
      { key: "sku", label: "SKU", width: 16 },
      {
        key: "product_name",
        label: "Produk",
        width: 25,
      },
      { key: "unit", label: "Satuan", width: 11 },
      {
        key: "ordered_quantity",
        label: "Dipesan",
        type: "number",
        width: 13,
      },
      {
        key: "delivered_quantity",
        label: "Terkirim",
        type: "number",
        width: 13,
      },
      {
        key: "pending_quantity",
        label: "Tersisa",
        type: "number",
        width: 13,
      },
      {
        key: "unit_price",
        label: "Harga satuan",
        type: "currency",
        width: 17,
      },
      {
        key: "discount_amount",
        label: "Diskon",
        type: "currency",
        width: 15,
      },
      {
        key: "item_subtotal",
        label: "Subtotal item",
        type: "currency",
        width: 18,
      },
    ];

    await sendExport({
      res,
      format: parsed.format,
      reportName: "penjualan",
      title: "Laporan Rincian Penjualan",
      sheetName: "Penjualan",
      filters,
      columns,
      rows,
      pdfGroup: {
        key: "so_number",
        label: "Sales Order",
        summary: {
          dateKey: "order_date",
          chartTitle: "Tren nilai penjualan aktif",
          metrics: [
            {
              label: "Total SO",
              type: "number",
              value: ({ transactions }) =>
                transactions.length,
            },
            {
              label: "Nilai penjualan aktif",
              type: "currency",
              value: ({ activeTransactions }) =>
                activeTransactions.reduce(
                  (total, { row }) =>
                    total + (Number(row.order_total) || 0),
                  0,
                ),
            },
            {
              label: "Unit dipesan aktif",
              type: "number",
              value: ({ activeRows, sumRows }) =>
                sumRows(activeRows, "ordered_quantity"),
            },
            {
              label: "Unit terkirim aktif",
              type: "number",
              value: ({ activeRows, sumRows }) =>
                sumRows(activeRows, "delivered_quantity"),
            },
          ],
        },
        transactionColumns: [
          {
            key: "so_number",
            label: "Nomor SO",
            width: 19,
          },
          {
            key: "order_date",
            label: "Tanggal",
            type: "date",
            width: 15,
          },
          {
            key: "requested_delivery_date",
            label: "Rencana kirim",
            type: "date",
            width: 16,
          },
          {
            key: "status",
            label: "Status",
            type: "status",
            width: 18,
          },
          {
            key: "customer_code",
            label: "Kode pelanggan",
            width: 17,
          },
          {
            key: "customer_name",
            label: "Pelanggan",
            width: 25,
          },
          {
            label: "Jenis produk",
            type: "number",
            width: 13,
            value: (_row, { groupRows }) =>
              groupRows.length,
          },
          {
            label: "Dipesan",
            type: "number",
            width: 13,
            value: (_row, { groupRows }) =>
              groupRows.reduce(
                (total, row) =>
                  total + Number(row.ordered_quantity),
                0,
              ),
          },
          {
            label: "Terkirim",
            type: "number",
            width: 13,
            value: (_row, { groupRows }) =>
              groupRows.reduce(
                (total, row) =>
                  total + Number(row.delivered_quantity),
                0,
              ),
          },
          {
            key: "order_total",
            label: "Total SO",
            type: "currency",
            width: 18,
          },
          { key: "notes", label: "Catatan", width: 28 },
        ],
        meta: [
          {
            label: "Tanggal",
            type: "date",
            width: 1,
            value: (row) => row.order_date,
          },
          {
            label: "Pelanggan",
            width: 2.4,
            value: (row) =>
              `${row.customer_code} - ${row.customer_name}`,
          },
          {
            label: "Status",
            type: "status",
            width: 1.2,
            value: (row) => row.status,
          },
          {
            label: "Total",
            type: "currency",
            width: 1.4,
            value: (row) => row.order_total,
          },
        ],
        itemColumns: [
          { key: "sku", label: "SKU", width: 80 },
          {
            key: "product_name",
            label: "Produk",
            width: 175,
          },
          { key: "unit", label: "Satuan", width: 48 },
          {
            key: "ordered_quantity",
            label: "Dipesan",
            type: "number",
            align: "right",
            width: 60,
          },
          {
            key: "delivered_quantity",
            label: "Terkirim",
            type: "number",
            align: "right",
            width: 60,
          },
          {
            key: "pending_quantity",
            label: "Tersisa",
            type: "number",
            align: "right",
            width: 60,
          },
          {
            key: "unit_price",
            label: "Harga satuan",
            type: "currency",
            align: "right",
            width: 85,
          },
          {
            key: "discount_amount",
            label: "Diskon",
            type: "currency",
            align: "right",
            width: 75,
          },
          {
            key: "item_subtotal",
            label: "Subtotal",
            type: "currency",
            align: "right",
            width: 95,
          },
        ],
      },
    });
  } catch (error) {
    console.error(
      "Error exporting sales report:",
      error,
    );

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to export sales report",
      });
    }
  }
};

module.exports = {
  exportPurchasingReport,
  exportSalesReport,
};
