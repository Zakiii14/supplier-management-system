const pool = require("../config/database");
const {
  EXCEL_MIME_TYPE,
  PDF_MIME_TYPE,
  buildExportFileName,
  createExcelReport,
  createPdfReport,
  formatStatus,
} = require("../services/reportExportService");
const {
  SUPPLIER_FINANCE_CTE,
  buildSupplierFinanceFilter,
  parseSupplierFinanceQuery,
} = require("../services/supplierFinanceReportService");
const { normalizeText } = require("../utils/reportUtils");

const EXPORT_FORMATS = ["xlsx", "pdf"];

const exportSupplierFinanceReport = async (req, res) => {
  try {
    const format = normalizeText(req.query.format).toLowerCase();
    if (!EXPORT_FORMATS.includes(format)) {
      return res.status(400).json({
        success: false,
        message: "Invalid export format. Use xlsx or pdf",
      });
    }

    const parsed = parseSupplierFinanceQuery({
      ...req.query,
      page: "1",
      limit: "100",
    });
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const { values, whereClause } = buildSupplierFinanceFilter(parsed);
    const result = await pool.query(
      `${SUPPLIER_FINANCE_CTE},
      filtered_supplier_finance AS (
        SELECT *
        FROM supplier_finance_rows sfr
        ${whereClause}
      )
      SELECT
        fsf.*,
        sp.id AS payment_id,
        sp.payment_number,
        sp.payment_date,
        sp.amount AS payment_amount,
        sp.method::TEXT AS payment_method,
        sp.reference_number AS payment_reference,
        sp.supplier_invoice_number,
        sp.notes AS payment_notes,
        u.full_name AS paid_by_name,
        (
          SELECT COUNT(*)::INTEGER
          FROM app.payment_proofs pp
          WHERE pp.supplier_payment_id = sp.id
        ) AS payment_proof_count
      FROM filtered_supplier_finance fsf
      LEFT JOIN app.supplier_payments sp
        ON sp.purchase_order_id = fsf.id
      LEFT JOIN app.users u
        ON u.id = sp.paid_by
      ORDER BY
        fsf.order_date DESC,
        fsf.po_number DESC,
        sp.payment_date,
        sp.payment_number`,
      values,
    );

    const rows = result.rows;
    const selectedSupplier = parsed.supplierId
      ? rows[0]
        ? `${rows[0].supplier_code} ${rows[0].supplier_name}`
        : "Supplier terpilih"
      : "Semua supplier";
    const detailFilter = (row) => Boolean(row.payment_id);
    const detailColumns = [
      { key: "po_number", label: "Nomor PO", width: 18 },
      { key: "supplier_name", label: "Supplier", width: 23 },
      { key: "payment_number", label: "Nomor pembayaran", width: 20 },
      { key: "payment_date", label: "Tanggal", type: "date", width: 15 },
      { key: "payment_method", label: "Metode", type: "status", width: 18 },
      { key: "payment_amount", label: "Jumlah", type: "currency", width: 18 },
      { key: "payment_reference", label: "Referensi", width: 20 },
      { key: "supplier_invoice_number", label: "Invoice supplier", width: 20 },
      { key: "payment_proof_count", label: "Bukti", type: "number", width: 10 },
      { key: "paid_by_name", label: "Dicatat oleh", width: 20 },
      { key: "payment_notes", label: "Catatan", width: 26 },
    ];
    const filters = [
      { label: "Pencarian", value: parsed.search || "Semua PO" },
      {
        label: "Status pembayaran",
        value: parsed.paymentStatus
          ? formatStatus(parsed.paymentStatus)
          : "Semua status",
      },
      { label: "Supplier", value: selectedSupplier },
      {
        label: "Periode PO",
        value: parsed.dateFrom || parsed.dateTo
          ? `${parsed.dateFrom || "awal"} s.d. ${parsed.dateTo || "hari ini"}`
          : "Semua tanggal",
      },
    ];

    const group = {
      key: "po_number",
      label: "Purchase order",
      statusKey: "payment_status",
      detailFilter,
      excel: {
        primarySheetName: "Utang Supplier",
        detailSheetName: "Pembayaran Supplier",
        primaryDescription:
          "Satu baris mewakili satu PO dan posisi pembayaran terkininya.",
        detailDescription:
          "Satu baris mewakili satu pembayaran supplier beserta kelengkapan buktinya.",
      },
      pdf: {
        sectionTitle: "Keuangan pembelian per PO",
        sectionDescription:
          "Nilai pembelian, pembayaran, sisa utang, dan rincian pembayaran ditampilkan per PO.",
        emptyDetailLabel: "Belum ada pembayaran supplier untuk PO ini.",
      },
      summary: {
        chartTitle: "Tren nilai pembelian dan pembayaran supplier",
        emptyTrendLabel: "Belum ada aktivitas keuangan pembelian.",
        note:
          "PO draft tidak ditampilkan; jatuh tempo masih berupa estimasi berdasarkan ketentuan PO.",
        trendColumns: [
          {
            key: "purchaseValue",
            label: "Nilai pembelian",
            type: "currency",
            color: "365F9D",
          },
          {
            key: "paymentValue",
            label: "Pembayaran supplier",
            type: "currency",
            color: "14805E",
          },
        ],
        buildTrend: ({ transactions, rows: reportRows, getPeriodKey }) => {
          const trend = new Map();
          transactions
            .filter(({ row }) => row.payment_status !== "CANCELLED")
            .forEach(({ row }) => {
              const period = getPeriodKey(row.order_date);
              const entry = trend.get(period) || {
                period,
                purchaseValue: 0,
                paymentValue: 0,
              };
              entry.purchaseValue += Number(row.total_amount) || 0;
              trend.set(period, entry);
            });
          reportRows
            .filter(detailFilter)
            .filter((row) => row.payment_status !== "CANCELLED")
            .forEach((row) => {
              const period = getPeriodKey(row.payment_date);
              const entry = trend.get(period) || {
                period,
                purchaseValue: 0,
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
            label: "Total PO",
            type: "number",
            value: ({ transactions }) => transactions.length,
          },
          {
            label: "Nilai pembelian aktif",
            type: "currency",
            value: ({ activeTransactions }) => activeTransactions.reduce(
              (sum, item) => sum + (Number(item.row.total_amount) || 0),
              0,
            ),
          },
          {
            label: "Pembayaran supplier",
            type: "currency",
            value: ({ activeRows }) => activeRows
              .filter(detailFilter)
              .reduce(
                (sum, row) => sum + (Number(row.payment_amount) || 0),
                0,
              ),
          },
          {
            label: "Sisa utang supplier",
            type: "currency",
            value: ({ transactions }) => transactions
              .filter(({ row }) =>
                !["PAID", "CANCELLED"].includes(row.payment_status),
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
        { key: "po_number", label: "Nomor PO", width: 19 },
        { key: "order_date", label: "Tanggal PO", type: "date", width: 15 },
        {
          key: "estimated_due_date",
          label: "Estimasi jatuh tempo",
          type: "date",
          width: 18,
        },
        { key: "payment_status", label: "Status", type: "status", width: 18 },
        { key: "supplier_code", label: "Kode supplier", width: 16 },
        { key: "supplier_name", label: "Supplier", width: 23 },
        { key: "payment_scheme", label: "Skema", type: "status", width: 18 },
        { key: "total_amount", label: "Nilai PO", type: "currency", width: 18 },
        { key: "paid_amount", label: "Sudah dibayar", type: "currency", width: 18 },
        {
          key: "outstanding_amount",
          label: "Sisa utang",
          type: "currency",
          width: 18,
        },
        { key: "payment_count", label: "Pembayaran", type: "number", width: 14 },
        { key: "proof_count", label: "Bukti", type: "number", width: 12 },
      ],
      meta: [
        { label: "Tanggal PO", type: "date", value: (row) => row.order_date },
        {
          label: "Supplier",
          width: 2,
          value: (row) => `${row.supplier_code} ${row.supplier_name}`,
        },
        { label: "Status", type: "status", value: (row) => row.payment_status },
        { label: "Nilai PO", type: "currency", value: (row) => row.total_amount },
        {
          label: "Sisa utang",
          type: "currency",
          value: (row) => row.outstanding_amount,
        },
      ],
      itemColumns: [
        { key: "payment_number", label: "Nomor pembayaran", width: 105 },
        { key: "payment_date", label: "Tanggal", type: "date", width: 72 },
        { key: "payment_method", label: "Metode", type: "status", width: 82 },
        {
          key: "payment_amount",
          label: "Jumlah",
          type: "currency",
          align: "right",
          width: 95,
        },
        { key: "payment_reference", label: "Referensi", width: 95 },
        { key: "supplier_invoice_number", label: "Invoice supplier", width: 95 },
        { key: "payment_proof_count", label: "Bukti", type: "number", width: 48 },
        { key: "paid_by_name", label: "Dicatat oleh", width: 90 },
        { key: "payment_notes", label: "Catatan", width: 105 },
      ],
    };

    const buffer = format === "xlsx"
      ? await createExcelReport({
        title: "Laporan Keuangan Pembelian",
        filters,
        rows,
        columns: detailColumns,
        group,
      })
      : await createPdfReport({
        title: "Laporan Keuangan Pembelian",
        filters,
        rows,
        group,
      });
    const fileName = buildExportFileName("keuangan-pembelian", format);

    res.status(200).set({
      "Content-Type": format === "xlsx" ? EXCEL_MIME_TYPE : PDF_MIME_TYPE,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": buffer.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    }).send(buffer);
  } catch (error) {
    console.error("Error exporting supplier finance report:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to export supplier finance report",
      });
    }
  }
};

module.exports = { exportSupplierFinanceReport };
