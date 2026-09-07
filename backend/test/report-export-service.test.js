const { test } = require("node:test");
const assert = require("node:assert/strict");
const { strFromU8, unzipSync } = require("fflate");
const {
  createExcelReport,
  createPdfReport,
  formatNumber,
} = require("../src/services/reportExportService");

const row = {
  po_number: "PO-2026-0001",
  order_date: new Date("2026-09-06T00:00:00+07:00"),
  expected_date: "2026-09-13",
  status: "RECEIVED",
  supplier_code: "SUP-001",
  supplier_name: "PT Bersih Sejahtera",
  sku: "SKU-D001",
  product_name: "Deterjen Cair 800ml",
  unit: "PCS",
  ordered_quantity: 10,
  received_quantity: 10,
  pending_quantity: 0,
  unit_price: 14500,
  item_subtotal: 145000,
  order_total: 145000,
  notes: "-",
};

const group = {
  key: "po_number",
  label: "Purchase Order",
  summary: {
    dateKey: "order_date",
    chartTitle: "Tren nilai pembelian aktif",
    metrics: [
      {
        label: "Total PO",
        type: "number",
        value: ({ transactions }) => transactions.length,
      },
      {
        label: "Nilai pembelian aktif",
        type: "currency",
        value: ({ activeTransactions }) =>
          activeTransactions.reduce(
            (total, transaction) =>
              total + Number(transaction.row.order_total),
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
    { key: "po_number", label: "Nomor PO" },
    { key: "order_date", label: "Tanggal", type: "date" },
    { key: "order_total", label: "Total PO", type: "currency" },
  ],
  meta: [
    {
      label: "Tanggal",
      type: "date",
      width: 1,
      value: (item) => item.order_date,
    },
    {
      label: "Supplier",
      width: 2.4,
      value: (item) =>
        `${item.supplier_code} - ${item.supplier_name}`,
    },
    {
      label: "Status",
      type: "status",
      width: 1.2,
      value: (item) => item.status,
    },
    {
      label: "Total",
      type: "currency",
      width: 1.4,
      value: (item) => item.order_total,
    },
  ],
  itemColumns: [
    { key: "sku", label: "SKU", width: 90 },
    { key: "product_name", label: "Produk", width: 220 },
    { key: "ordered_quantity", label: "Dipesan", type: "number", width: 80 },
    { key: "received_quantity", label: "Diterima", type: "number", width: 80 },
    { key: "item_subtotal", label: "Subtotal", type: "currency", width: 110 },
  ],
};

const report = {
  title: "Laporan Rincian Pembelian",
  filters: [
    { label: "Pencarian", value: "Semua data" },
    { label: "Status", value: "Semua status" },
    { label: "Supplier", value: "Semua supplier" },
    { label: "Periode", value: "Semua tanggal" },
  ],
  rows: [row],
  group,
};

test("report export creates a three-sheet workbook and a PDF without footer-only pages", async () => {
  const workbook = await createExcelReport({
    ...report,
    columns: [
      { key: "po_number", label: "Nomor PO" },
      { key: "order_date", label: "Tanggal", type: "date" },
      { key: "sku", label: "SKU" },
      { key: "product_name", label: "Produk" },
      {
        key: "item_subtotal",
        label: "Subtotal item",
        type: "currency",
      },
    ],
  });
  const workbookFiles = unzipSync(workbook);
  const workbookXml = strFromU8(
    workbookFiles["xl/workbook.xml"],
  );
  const summaryXml = strFromU8(
    workbookFiles["xl/worksheets/sheet1.xml"],
  );
  const detailXml = strFromU8(
    workbookFiles["xl/worksheets/sheet3.xml"],
  );

  assert.match(workbookXml, /name="Ringkasan"/);
  assert.match(workbookXml, /name="Transaksi"/);
  assert.match(workbookXml, /name="Rincian Item"/);
  assert.match(summaryXml, /Nilai pembelian aktif/);
  assert.match(detailXml, /06 Sep 2026/);
  assert.match(detailXml, /PO-2026-0001/);
  assert.match(detailXml, /SKU-D001/);
  assert.ok(workbookFiles["xl/charts/chart1.xml"]);

  const pdf = await createPdfReport(report);
  const pageObjects = pdf
    .toString("latin1")
    .match(/\/Type\s*\/Page\b/g);

  assert.equal(pageObjects?.length, 1);
});

test("report export supports named sheets, filtered details, and two chart series", async () => {
  assert.equal(formatNumber("199.000"), "199");

  const movementRows = [
    {
      sku: "SKU-001",
      product_name: "Sabun Cair",
      status: "LOW",
      current_stock: 8,
      movement_id: "movement-1",
      movement_date: "2026-09-06",
      inbound: 12,
      outbound: 4,
    },
    {
      sku: "SKU-002",
      product_name: "Sabun Batang",
      status: "AVAILABLE",
      current_stock: 20,
      movement_id: null,
      movement_date: null,
      inbound: 0,
      outbound: 0,
    },
  ];
  const movementGroup = {
    key: "sku",
    label: "Produk",
    detailFilter: (item) => Boolean(item.movement_id),
    excel: {
      primarySheetName: "Produk",
      detailSheetName: "Pergerakan Stok",
    },
    pdf: {
      sectionTitle: "Persediaan per produk",
      emptyDetailLabel: "Tidak ada pergerakan.",
    },
    summary: {
      chartTitle: "Tren pergerakan stok",
      note: "Posisi stok menunjukkan kondisi terkini.",
      trendColumns: [
        { key: "inbound", label: "Stok masuk", type: "number", color: "14805E" },
        { key: "outbound", label: "Stok keluar", type: "number", color: "D92D20" },
      ],
      buildTrend: () => [{ period: "2026-09", inbound: 12, outbound: 4 }],
      metrics: [
        { label: "Produk", type: "number", value: ({ transactions }) => transactions.length },
        { label: "Stok", type: "number", value: ({ transactions }) => transactions.reduce((total, item) => total + item.row.current_stock, 0) },
      ],
    },
    transactionColumns: [
      { key: "sku", label: "SKU" },
      { key: "product_name", label: "Produk" },
      { key: "current_stock", label: "Stok", type: "number" },
    ],
    meta: [
      { label: "Nama", value: (item) => item.product_name },
      { label: "Status", type: "status", value: (item) => item.status },
    ],
    itemColumns: [
      { key: "movement_date", label: "Tanggal", type: "date", width: 150 },
      { key: "inbound", label: "Masuk", type: "number", width: 100 },
      { key: "outbound", label: "Keluar", type: "number", width: 100 },
    ],
  };
  const workbook = await createExcelReport({
    title: "Laporan Persediaan",
    filters: [{ label: "Periode", value: "Sep 2026" }],
    columns: movementGroup.itemColumns,
    rows: movementRows,
    group: movementGroup,
  });
  const files = unzipSync(workbook);
  const workbookXml = strFromU8(files["xl/workbook.xml"]);
  const detailXml = strFromU8(files["xl/worksheets/sheet3.xml"]);
  const chartXml = strFromU8(files["xl/charts/chart1.xml"]);
  const drawingXml = strFromU8(
    files["xl/drawings/drawing1.xml"],
  );

  assert.match(workbookXml, /name="Produk"/);
  assert.match(workbookXml, /name="Pergerakan Stok"/);
  assert.match(detailXml, /06 Sep 2026/);
  assert.doesNotMatch(detailXml, /SKU-002/);
  assert.match(chartXml, /Stok masuk/);
  assert.match(chartXml, /Stok keluar/);
  assert.match(
    drawingXml,
    /<xdr:to><xdr:col>10<\/xdr:col>/,
  );

  const pdf = await createPdfReport({
    title: "Laporan Persediaan",
    filters: [{ label: "Periode", value: "Sep 2026" }],
    rows: movementRows,
    group: movementGroup,
  });
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
});
