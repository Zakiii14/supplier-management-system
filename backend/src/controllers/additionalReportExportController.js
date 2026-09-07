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
  formatNumber,
  formatStatus,
} = require("../services/reportExportService");

const EXPORT_FORMATS = ["xlsx", "pdf"];
const STOCK_STATUSES = ["AVAILABLE", "LOW", "OUT"];
const INVOICE_STATUSES = [
  "UNPAID",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "CANCELLED",
];
const INBOUND_MOVEMENT_TYPES = [
  "PURCHASE_RECEIPT",
  "ADJUSTMENT_IN",
  "RETURN_IN",
];
const OUTBOUND_MOVEMENT_TYPES = [
  "SALES_ISSUE",
  "ADJUSTMENT_OUT",
  "RETURN_OUT",
];
const EFFECTIVE_INVOICE_STATUS_SQL = `
  CASE
    WHEN i.due_date < CURRENT_DATE
      AND i.status IN ('UNPAID', 'PARTIAL')
    THEN 'OVERDUE'
    ELSE i.status::TEXT
  END
`;

const parseBaseExportQuery = (query) => {
  const parsed = parseReportQuery({
    ...query,
    page: "1",
    limit: "100",
  });
  if (parsed.error) return { error: parsed.error };

  const format = normalizeText(query.format)
    .toLocaleLowerCase("id-ID");
  if (!EXPORT_FORMATS.includes(format)) {
    return { error: "Invalid export format. Use xlsx or pdf" };
  }
  return { ...parsed, format };
};

const sendExport = async ({
  res,
  format,
  reportName,
  title,
  filters,
  columns,
  rows,
  group,
}) => {
  const buffer = format === "xlsx"
    ? await createExcelReport({ title, filters, columns, rows, group })
    : await createPdfReport({ title, filters, rows, group });
  const fileName = buildExportFileName(reportName, format);

  res.status(200).set({
    "Content-Type": format === "xlsx" ? EXCEL_MIME_TYPE : PDF_MIME_TYPE,
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Content-Length": buffer.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  }).send(buffer);
};

const dateFilterLabel = (parsed) =>
  parsed.dateFrom || parsed.dateTo
    ? `${parsed.dateFrom || "awal"} s.d. ${parsed.dateTo || "hari ini"}`
    : "Semua tanggal";

const exportInventoryReport = async (req, res) => {
  try {
    const parsed = parseBaseExportQuery(req.query);
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const categoryId = normalizeText(req.query.category_id);
    const stockStatus = normalizeEnum(req.query.stock_status);
    const validationError =
      validateEnum(stockStatus, STOCK_STATUSES, "Invalid stock status") ||
      validateUuid(categoryId, "category ID");
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const values = [];
    const productConditions = ["p.status = 'ACTIVE'"];
    const movementConditions = [];

    if (parsed.search) {
      values.push(`%${parsed.search}%`);
      productConditions.push(`(
        p.sku ILIKE $${values.length}
        OR p.product_name ILIKE $${values.length}
        OR c.category_name ILIKE $${values.length}
        OR s.supplier_name ILIKE $${values.length}
      )`);
    }
    if (categoryId) {
      values.push(categoryId);
      productConditions.push(`p.category_id = $${values.length}`);
    }
    if (stockStatus === "OUT") productConditions.push("p.current_stock = 0");
    if (stockStatus === "LOW") {
      productConditions.push("p.current_stock > 0 AND p.current_stock <= p.minimum_stock");
    }
    if (stockStatus === "AVAILABLE") {
      productConditions.push("p.current_stock > p.minimum_stock");
    }
    if (parsed.dateFrom) {
      values.push(parsed.dateFrom);
      movementConditions.push(`im.movement_date >= $${values.length}::DATE`);
    }
    if (parsed.dateTo) {
      values.push(parsed.dateTo);
      movementConditions.push(
        `im.movement_date < ($${values.length}::DATE + INTERVAL '1 day')`,
      );
    }

    const movementJoinConditions = movementConditions.length
      ? `AND ${movementConditions.join(" AND ")}`
      : "";
    const result = await pool.query(
      `
      SELECT
        p.id AS product_id,
        p.sku,
        p.product_name,
        p.unit,
        c.category_code,
        c.category_name,
        s.supplier_code,
        s.supplier_name,
        p.current_stock,
        p.minimum_stock,
        p.purchase_price,
        p.current_stock * p.purchase_price AS inventory_value,
        CASE
          WHEN p.current_stock = 0 THEN 'OUT'
          WHEN p.current_stock <= p.minimum_stock THEN 'LOW'
          ELSE 'AVAILABLE'
        END AS stock_status,
        im.id AS movement_id,
        CASE WHEN im.id IS NOT NULL THEN CONCAT(
          'MOV-', UPPER(LEFT(MD5(im.id::TEXT), 8))
        ) END AS movement_number,
        im.movement_type::TEXT AS movement_type,
        im.quantity AS movement_quantity,
        im.reference_type,
        COALESCE(d.delivery_number, gr.receipt_number) AS reference_number,
        im.movement_date,
        im.notes AS movement_notes,
        u.full_name AS created_by_name
      FROM app.products p
      JOIN app.categories c ON c.id = p.category_id
      JOIN app.suppliers s ON s.id = p.supplier_id
      LEFT JOIN app.inventory_movements im
        ON im.product_id = p.id
        ${movementJoinConditions}
      LEFT JOIN app.users u ON u.id = im.created_by
      LEFT JOIN app.deliveries d
        ON im.reference_type = 'DELIVERY' AND d.id = im.reference_id
      LEFT JOIN app.goods_receipts gr
        ON im.reference_type = 'GOODS_RECEIPT' AND gr.id = im.reference_id
      WHERE ${productConditions.join(" AND ")}
      ORDER BY p.product_name, p.sku, im.movement_date DESC
      `,
      values,
    );
    const rows = result.rows;
    const selectedCategory = categoryId && rows[0]
      ? `${rows[0].category_code} ${rows[0].category_name}`
      : categoryId ? "Kategori terpilih" : "Semua kategori";
    const detailFilter = (row) => Boolean(row.movement_id);
    const sumMovement = (groupRows, types) => groupRows.reduce(
      (total, row) => types.includes(row.movement_type)
        ? total + (Number(row.movement_quantity) || 0)
        : total,
      0,
    );

    await sendExport({
      res,
      format: parsed.format,
      reportName: "persediaan",
      title: "Laporan Persediaan",
      filters: [
        { label: "Pencarian", value: parsed.search || "Semua produk" },
        { label: "Status stok", value: stockStatus ? formatStatus(stockStatus) : "Semua status" },
        { label: "Kategori", value: selectedCategory },
        { label: "Periode pergerakan", value: dateFilterLabel(parsed) },
      ],
      rows,
      columns: [
        { key: "sku", label: "SKU", width: 15 },
        { key: "product_name", label: "Produk", width: 24 },
        { key: "movement_number", label: "ID pergerakan", width: 18 },
        { key: "movement_date", label: "Tanggal", type: "date", width: 15 },
        { key: "movement_type", label: "Jenis", type: "status", width: 22 },
        { key: "movement_quantity", label: "Jumlah", type: "number", width: 12 },
        { key: "reference_number", label: "Referensi", width: 18 },
        { key: "created_by_name", label: "Petugas", width: 20 },
        { key: "movement_notes", label: "Catatan", width: 28 },
      ],
      group: {
        key: "sku",
        label: "Produk",
        detailFilter,
        excel: {
          primarySheetName: "Produk",
          detailSheetName: "Pergerakan Stok",
          primaryDescription: "Satu baris mewakili satu produk dan posisi stok terkini.",
          detailDescription: "Satu baris mewakili satu pergerakan stok dalam periode terpilih.",
        },
        pdf: {
          sectionTitle: "Persediaan per produk",
          sectionDescription:
            "Posisi stok terkini dilengkapi rincian pergerakan dalam periode terpilih.",
          emptyDetailLabel: "Tidak ada pergerakan stok pada periode terpilih.",
        },
        summary: {
          chartTitle: "Tren pergerakan stok",
          emptyTrendLabel: "Belum ada pergerakan stok pada periode terpilih.",
          note:
            "Posisi stok menunjukkan kondisi terkini; periode hanya membatasi rincian pergerakan.",
          trendColumns: [
            { key: "inboundQuantity", label: "Stok masuk", type: "number", color: "14805E" },
            { key: "outboundQuantity", label: "Stok keluar", type: "number", color: "D92D20" },
          ],
          buildTrend: ({ rows: reportRows, getPeriodKey }) => {
            const trend = new Map();
            reportRows.filter(detailFilter).forEach((row) => {
              const period = getPeriodKey(row.movement_date);
              const entry = trend.get(period) || {
                period,
                inboundQuantity: 0,
                outboundQuantity: 0,
              };
              if (INBOUND_MOVEMENT_TYPES.includes(row.movement_type)) {
                entry.inboundQuantity += Number(row.movement_quantity) || 0;
              }
              if (OUTBOUND_MOVEMENT_TYPES.includes(row.movement_type)) {
                entry.outboundQuantity += Number(row.movement_quantity) || 0;
              }
              trend.set(period, entry);
            });
            return Array.from(trend.values()).sort((a, b) => a.period.localeCompare(b.period));
          },
          metrics: [
            {
              label: "Total produk",
              type: "number",
              value: ({ transactions }) => transactions.length,
            },
            {
              label: "Total unit stok",
              type: "number",
              value: ({ transactions }) => transactions.reduce(
                (sum, item) =>
                  sum + (Number(item.row.current_stock) || 0),
                0,
              ),
            },
            {
              label: "Nilai persediaan",
              type: "currency",
              value: ({ transactions }) => transactions.reduce(
                (sum, item) =>
                  sum + (Number(item.row.inventory_value) || 0),
                0,
              ),
            },
            {
              label: "Perlu perhatian",
              type: "number",
              value: ({ transactions }) => transactions.filter(
                ({ row }) => ["LOW", "OUT"].includes(row.stock_status),
              ).length,
            },
          ],
        },
        transactionColumns: [
          { key: "sku", label: "SKU", width: 15 },
          { key: "product_name", label: "Produk", width: 25 },
          { key: "category_name", label: "Kategori", width: 20 },
          { key: "supplier_name", label: "Supplier", width: 22 },
          { key: "unit", label: "Satuan", width: 11 },
          { key: "current_stock", label: "Stok", type: "number", width: 12 },
          { key: "minimum_stock", label: "Minimum", type: "number", width: 12 },
          { key: "stock_status", label: "Status", type: "status", width: 17 },
          { key: "purchase_price", label: "Harga beli", type: "currency", width: 17 },
          { key: "inventory_value", label: "Nilai stok", type: "currency", width: 18 },
          {
            label: "Masuk",
            type: "number",
            width: 12,
            value: (_row, { groupRows }) =>
              sumMovement(groupRows, INBOUND_MOVEMENT_TYPES),
          },
          {
            label: "Keluar",
            type: "number",
            width: 12,
            value: (_row, { groupRows }) =>
              sumMovement(groupRows, OUTBOUND_MOVEMENT_TYPES),
          },
        ],
        meta: [
          { label: "Nama", width: 2, value: (row) => row.product_name },
          { label: "Kategori", width: 1.5, value: (row) => row.category_name },
          { label: "Status", type: "status", value: (row) => row.stock_status },
          {
            label: "Stok / Minimum",
            value: (row) => row.current_stock,
            format: (_value, row) =>
              `${formatNumber(row.current_stock)} / ${formatNumber(
                row.minimum_stock,
              )} ${row.unit}`,
          },
          { label: "Nilai stok", type: "currency", value: (row) => row.inventory_value },
        ],
        itemColumns: [
          { key: "movement_number", label: "ID pergerakan", width: 95 },
          { key: "movement_date", label: "Tanggal", type: "date", width: 78 },
          { key: "movement_type", label: "Jenis", type: "status", width: 115 },
          { key: "movement_quantity", label: "Jumlah", type: "number", align: "right", width: 55 },
          { key: "reference_number", label: "Referensi", width: 95 },
          { key: "created_by_name", label: "Petugas", width: 100 },
          { key: "movement_notes", label: "Catatan", width: 150 },
        ],
      },
    });
  } catch (error) {
    console.error("Error exporting inventory report:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Failed to export inventory report" });
    }
  }
};

const exportFinanceReport = async (req, res) => {
  try {
    const parsed = parseBaseExportQuery(req.query);
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const customerId = normalizeText(req.query.customer_id);
    const status = normalizeEnum(req.query.status);
    const validationError =
      validateEnum(status, INVOICE_STATUSES, "Invalid invoice status") ||
      validateUuid(customerId, "customer ID");
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const values = [];
    const invoiceConditions = [];
    const paymentJoinConditions = [];
    if (parsed.search) {
      values.push(`%${parsed.search}%`);
      invoiceConditions.push(`(
        i.invoice_number ILIKE $${values.length}
        OR so.so_number ILIKE $${values.length}
        OR c.customer_code ILIKE $${values.length}
        OR c.customer_name ILIKE $${values.length}
      )`);
    }
    if (status) {
      values.push(status);
      invoiceConditions.push(`${EFFECTIVE_INVOICE_STATUS_SQL} = $${values.length}`);
    }
    if (customerId) {
      values.push(customerId);
      invoiceConditions.push(`i.customer_id = $${values.length}`);
    }
    if (parsed.dateFrom) {
      values.push(parsed.dateFrom);
      invoiceConditions.push(`i.invoice_date >= $${values.length}::DATE`);
      paymentJoinConditions.push(`p.payment_date >= $${values.length}::DATE`);
    }
    if (parsed.dateTo) {
      values.push(parsed.dateTo);
      invoiceConditions.push(`i.invoice_date <= $${values.length}::DATE`);
      paymentJoinConditions.push(`p.payment_date <= $${values.length}::DATE`);
    }

    const paymentJoin = paymentJoinConditions.length
      ? `AND ${paymentJoinConditions.join(" AND ")}`
      : "";
    const whereClause = invoiceConditions.length
      ? `WHERE ${invoiceConditions.join(" AND ")}`
      : "";
    const result = await pool.query(
      `
      SELECT
        i.id AS invoice_id,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        ${EFFECTIVE_INVOICE_STATUS_SQL} AS status,
        i.subtotal,
        i.discount_amount,
        i.tax_amount,
        i.grand_total,
        i.paid_amount,
        GREATEST(i.grand_total - i.paid_amount, 0) AS outstanding_amount,
        i.notes AS invoice_notes,
        so.so_number,
        c.customer_code,
        c.customer_name,
        p.id AS payment_id,
        p.payment_number,
        p.payment_date,
        p.amount AS payment_amount,
        p.method::TEXT AS payment_method,
        p.reference_number AS payment_reference,
        p.notes AS payment_notes,
        u.full_name AS received_by_name
      FROM app.invoices i
      JOIN app.sales_orders so ON so.id = i.sales_order_id
      JOIN app.customers c ON c.id = i.customer_id
      LEFT JOIN app.payments p ON p.invoice_id = i.id ${paymentJoin}
      LEFT JOIN app.users u ON u.id = p.received_by
      ${whereClause}
      ORDER BY i.invoice_date DESC, i.invoice_number DESC, p.payment_date, p.payment_number
      `,
      values,
    );
    const rows = result.rows;
    const selectedCustomer = customerId && rows[0]
      ? `${rows[0].customer_code} ${rows[0].customer_name}`
      : customerId ? "Pelanggan terpilih" : "Semua pelanggan";
    const detailFilter = (row) => Boolean(row.payment_id);

    await sendExport({
      res,
      format: parsed.format,
      reportName: "keuangan",
      title: "Laporan Keuangan",
      filters: [
        { label: "Pencarian", value: parsed.search || "Semua invoice" },
        { label: "Status", value: status ? formatStatus(status) : "Semua status" },
        { label: "Pelanggan", value: selectedCustomer },
        { label: "Periode", value: dateFilterLabel(parsed) },
      ],
      rows,
      columns: [
        { key: "invoice_number", label: "Nomor invoice", width: 18 },
        { key: "customer_name", label: "Pelanggan", width: 23 },
        { key: "payment_number", label: "Nomor pembayaran", width: 20 },
        { key: "payment_date", label: "Tanggal", type: "date", width: 15 },
        { key: "payment_method", label: "Metode", type: "status", width: 17 },
        { key: "payment_amount", label: "Jumlah", type: "currency", width: 18 },
        { key: "payment_reference", label: "Referensi", width: 19 },
        { key: "received_by_name", label: "Penerima", width: 20 },
        { key: "payment_notes", label: "Catatan", width: 27 },
      ],
      group: {
        key: "invoice_number",
        label: "Invoice",
        detailFilter,
        excel: {
          primarySheetName: "Invoice",
          detailSheetName: "Pembayaran",
          primaryDescription: "Satu baris mewakili satu invoice dan posisi pembayaran terkini.",
          detailDescription: "Satu baris mewakili satu pembayaran dalam periode terpilih.",
        },
        pdf: {
          sectionTitle: "Keuangan per invoice",
          sectionDescription:
            "Nilai invoice, posisi tagihan, dan rincian pembayarannya ditampilkan per dokumen.",
          emptyDetailLabel: "Belum ada pembayaran pada periode terpilih.",
        },
        summary: {
          chartTitle: "Tren invoice dan pembayaran",
          emptyTrendLabel: "Belum ada aktivitas keuangan pada periode terpilih.",
          note:
            "Nilai invoice tidak menghitung dokumen yang dibatalkan; rincian pembayaran mengikuti periode terpilih.",
          trendColumns: [
            {
              key: "invoiceValue",
              label: "Nilai invoice",
              type: "currency",
              color: "365F9D",
            },
            {
              key: "paymentValue",
              label: "Pembayaran",
              type: "currency",
              color: "14805E",
            },
          ],
          buildTrend: ({ transactions, rows: reportRows, getPeriodKey }) => {
            const trend = new Map();
            transactions
              .filter(({ row }) => row.status !== "CANCELLED")
              .forEach(({ row }) => {
                const period = getPeriodKey(row.invoice_date);
                const entry = trend.get(period) || {
                  period,
                  invoiceValue: 0,
                  paymentValue: 0,
                };
                entry.invoiceValue += Number(row.grand_total) || 0;
                trend.set(period, entry);
              });
            reportRows
              .filter(detailFilter)
              .filter((row) => row.status !== "CANCELLED")
              .forEach((row) => {
                const period = getPeriodKey(row.payment_date);
                const entry = trend.get(period) || {
                  period,
                  invoiceValue: 0,
                  paymentValue: 0,
                };
                entry.paymentValue += Number(row.payment_amount) || 0;
                trend.set(period, entry);
              });
            return Array.from(trend.values()).sort((a, b) =>
              a.period.localeCompare(b.period),
            );
          },
          metrics: [
            {
              label: "Total invoice",
              type: "number",
              value: ({ transactions }) => transactions.length,
            },
            {
              label: "Nilai invoice aktif",
              type: "currency",
              value: ({ activeTransactions }) =>
                activeTransactions.reduce(
                  (sum, item) =>
                    sum + (Number(item.row.grand_total) || 0),
                  0,
                ),
            },
            {
              label: "Pembayaran diterima",
              type: "currency",
              value: ({ activeRows }) => activeRows
                .filter(detailFilter)
                .reduce(
                  (sum, row) =>
                    sum + (Number(row.payment_amount) || 0),
                  0,
                ),
            },
            {
              label: "Sisa piutang",
              type: "currency",
              value: ({ transactions }) => transactions
                .filter(({ row }) =>
                  ["UNPAID", "PARTIAL", "OVERDUE"].includes(row.status),
                )
                .reduce(
                  (sum, item) =>
                    sum + (Number(item.row.outstanding_amount) || 0),
                  0,
                ),
            },
          ],
        },
        transactionColumns: [
          { key: "invoice_number", label: "Nomor invoice", width: 19 },
          { key: "invoice_date", label: "Tanggal", type: "date", width: 14 },
          { key: "due_date", label: "Jatuh tempo", type: "date", width: 14 },
          { key: "status", label: "Status", type: "status", width: 18 },
          { key: "so_number", label: "Nomor SO", width: 18 },
          { key: "customer_code", label: "Kode pelanggan", width: 16 },
          { key: "customer_name", label: "Pelanggan", width: 23 },
          { key: "grand_total", label: "Total invoice", type: "currency", width: 18 },
          { key: "paid_amount", label: "Sudah dibayar", type: "currency", width: 18 },
          { key: "outstanding_amount", label: "Sisa tagihan", type: "currency", width: 18 },
          { key: "invoice_notes", label: "Catatan", width: 26 },
        ],
        meta: [
          { label: "Tanggal", type: "date", value: (row) => row.invoice_date },
          {
            label: "Pelanggan",
            width: 2,
            value: (row) =>
              `${row.customer_code} ${row.customer_name}`,
          },
          { label: "Status", type: "status", value: (row) => row.status },
          { label: "Total", type: "currency", value: (row) => row.grand_total },
          { label: "Sisa tagihan", type: "currency", value: (row) => row.outstanding_amount },
        ],
        itemColumns: [
          { key: "payment_number", label: "Nomor pembayaran", width: 110 },
          { key: "payment_date", label: "Tanggal", type: "date", width: 75 },
          { key: "payment_method", label: "Metode", type: "status", width: 80 },
          { key: "payment_amount", label: "Jumlah", type: "currency", align: "right", width: 100 },
          { key: "payment_reference", label: "Referensi", width: 100 },
          { key: "received_by_name", label: "Penerima", width: 100 },
          { key: "payment_notes", label: "Catatan", width: 125 },
        ],
      },
    });
  } catch (error) {
    console.error("Error exporting finance report:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Failed to export finance report" });
    }
  }
};

module.exports = {
  exportFinanceReport,
  exportInventoryReport,
};
