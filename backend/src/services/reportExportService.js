const PDFDocument = require("pdfkit");
const { strToU8, zipSync } = require("fflate");

const STATUS_LABELS = {
  DRAFT: "Draft",
  SUBMITTED: "Diajukan",
  PARTIALLY_RECEIVED: "Diterima sebagian",
  RECEIVED: "Diterima",
  CONFIRMED: "Dikonfirmasi",
  PARTIALLY_DELIVERED: "Dikirim sebagian",
  DELIVERED: "Terkirim",
  CANCELLED: "Dibatalkan",
  AVAILABLE: "Tersedia",
  LOW: "Stok menipis",
  OUT: "Stok habis",
  UNPAID: "Belum dibayar",
  PARTIAL: "Dibayar sebagian",
  PAID: "Lunas",
  OVERDUE: "Jatuh tempo",
  PURCHASE_RECEIPT: "Penerimaan pembelian",
  SALES_ISSUE: "Pengeluaran penjualan",
  ADJUSTMENT_IN: "Penyesuaian masuk",
  ADJUSTMENT_OUT: "Penyesuaian keluar",
  RETURN_IN: "Retur masuk",
  RETURN_OUT: "Retur keluar",
  CASH: "Tunai",
  BANK_TRANSFER: "Transfer bank",
  GIRO: "Giro",
  OTHER: "Lainnya",
  CREDIT_CARD: "Kartu kredit",
  E_WALLET: "Dompet digital",
  DIRECT: "Pembayaran langsung",
  TERM: "Termin pembayaran",
  DOWN_PAYMENT: "DP dan pelunasan",
  COD: "Bayar saat barang diterima",
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PDF_MIME_TYPE = "application/pdf";

const getDateParts = (value) => {
  if (!value) return null;

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).formatToParts(date);
  const readPart = (type) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: readPart("year"),
    month: readPart("month"),
    day: readPart("day"),
  };
};

const formatDate = (value, long = false) => {
  const parts = getDateParts(value);
  if (!parts) return value ? String(value) : "-";

  const { year, month, day } = parts;
  if (long) {
    const monthName = new Intl.DateTimeFormat("id-ID", {
      month: "long",
      timeZone: "Asia/Jakarta",
    }).format(new Date(Date.UTC(year, month - 1, 1)));
    return `${day} ${monthName} ${year}`;
  }

  return `${String(day).padStart(2, "0")} ${
    MONTH_LABELS[month - 1]
  } ${year}`;
};

const getPeriodKey = (value) => {
  const parts = getDateParts(value);
  return parts
    ? `${parts.year}-${String(parts.month).padStart(2, "0")}`
    : "Tanpa tanggal";
};

const formatPeriod = (period) => {
  const [year, month] = String(period || "").split("-");
  return year && MONTH_LABELS[Number(month) - 1]
    ? `${MONTH_LABELS[Number(month) - 1]} ${year}`
    : period || "-";
};

const formatNumber = (value) =>
  new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const formatCurrency = (value) =>
  `Rp ${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)}`;

const formatCompactCurrency = (value) => {
  const amount = Number(value) || 0;
  if (amount >= 1_000_000_000) {
    return `Rp ${formatNumber(amount / 1_000_000_000)} M`;
  }
  if (amount >= 1_000_000) {
    return `Rp ${formatNumber(amount / 1_000_000)} jt`;
  }
  if (amount >= 1_000) {
    return `Rp ${formatNumber(amount / 1_000)} rb`;
  }
  return formatCurrency(amount);
};

const formatStatus = (value) =>
  STATUS_LABELS[value] ||
  String(value || "-")
    .toLocaleLowerCase("id-ID")
    .split("_")
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toLocaleUpperCase("id-ID") +
        part.slice(1),
    )
    .join(" ");

const formatDisplayValue = (value, type) => {
  if (value === null || value === undefined || value === "") return "-";
  if (type === "currency") return formatCurrency(value);
  if (type === "number") return formatNumber(value);
  if (type === "date") return formatDate(value);
  if (type === "status") return formatStatus(value);
  return String(value);
};

const getColumnValue = (row, column, context) =>
  typeof column.value === "function"
    ? column.value(row, context)
    : row[column.key];

const getExcelValue = (row, column, context) => {
  const value = getColumnValue(row, column, context);
  if (value === null || value === undefined || value === "") return "-";
  if (["currency", "number"].includes(column.type)) {
    return Number(value) || 0;
  }
  if (column.type === "date") return formatDate(value);
  if (column.type === "status") return formatStatus(value);
  return String(value);
};

const escapeXml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const getExcelColumnName = (number) => {
  let name = "";
  let current = number;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
};

const buildExcelCell = ({ reference, value, style, numeric = false }) =>
  numeric
    ? `<c r="${reference}" s="${style}"><v>${
      Number(value) || 0
    }</v></c>`
    : `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
      value,
    )}</t></is></c>`;

const groupReportRows = (rows, group) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = String(row[group.key]);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return Array.from(map.values());
};

const sumRows = (rows, key) =>
  rows.reduce(
    (total, row) => total + (Number(row[key]) || 0),
    0,
  );

const buildReportPresentation = (rows, group) => {
  const groupedRows = groupReportRows(rows, group);
  const transactions = groupedRows.map((transactionRows) => ({
    row: transactionRows[0],
    rows: transactionRows,
  }));
  const statusKey = group.statusKey || "status";
  const activeTransactions = transactions.filter(
    ({ row }) => row[statusKey] !== "CANCELLED",
  );
  const activeRows = activeTransactions.flatMap(({ rows: itemRows }) =>
    itemRows,
  );
  const context = {
    rows,
    groupedRows,
    transactions,
    activeTransactions,
    activeRows,
    sumRows,
    getPeriodKey,
  };
  const metrics = group.summary.metrics.map((metric) => ({
    ...metric,
    value: metric.value(context),
  }));
  let trend;
  if (group.summary.buildTrend) {
    trend = group.summary.buildTrend(context);
  } else {
    const trendMap = new Map();
    activeTransactions.forEach(({ row }) => {
      const period = getPeriodKey(row[group.summary.dateKey]);
      const entry = trendMap.get(period) || {
        period,
        totalTransactions: 0,
        totalValue: 0,
      };
      entry.totalTransactions += 1;
      entry.totalValue += Number(row.order_total) || 0;
      trendMap.set(period, entry);
    });
    trend = Array.from(trendMap.values()).sort((a, b) =>
      a.period.localeCompare(b.period),
    );
  }

  const trendColumns = group.summary.trendColumns || [
    {
      key: "totalTransactions",
      label: "Jumlah transaksi",
      type: "number",
      chart: false,
    },
    {
      key: "totalValue",
      label: "Nilai transaksi",
      type: "currency",
      color: "365F9D",
    },
  ];

  return {
    groupedRows,
    transactions,
    metrics,
    trend,
    trendColumns,
  };
};

const getExcelCellStyle = (column, alternate) => {
  if (column.type === "currency") return alternate ? 10 : 9;
  if (column.type === "number") return alternate ? 8 : 7;
  return alternate ? 6 : 5;
};

const buildTableWorksheet = ({
  title,
  subtitle,
  columns,
  data,
  contextForRow,
}) => {
  const lastColumn = Math.max(columns.length, 1);
  const lastColumnName = getExcelColumnName(lastColumn);
  const headerCells = columns
    .map((column, index) =>
      buildExcelCell({
        reference: `${getExcelColumnName(index + 1)}4`,
        value: column.label,
        style: 4,
      }),
    )
    .join("");
  const dataRows = data
    .map((dataRow, rowIndex) => {
      const excelRow = rowIndex + 5;
      const context = contextForRow
        ? contextForRow(dataRow)
        : undefined;
      const alternate = rowIndex % 2 === 1;
      const cells = columns
        .map((column, index) => {
          const numeric = ["currency", "number"].includes(column.type);
          return buildExcelCell({
            reference: `${getExcelColumnName(index + 1)}${excelRow}`,
            value: getExcelValue(
              dataRow.row || dataRow,
              column,
              context,
            ),
            style: getExcelCellStyle(column, alternate),
            numeric,
          });
        })
        .join("");
      return `<row r="${excelRow}" ht="22" customHeight="1">${cells}</row>`;
    })
    .join("");
  const emptyRow = data.length
    ? ""
    : `<row r="5" ht="30" customHeight="1">${buildExcelCell({
      reference: "A5",
      value: "Tidak ada data yang sesuai dengan filter.",
      style: 11,
    })}</row>`;
  const lastDataRow = Math.max(data.length + 4, 5);
  const columnDefinitions = columns
    .map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${
          column.width || 16
        }" customWidth="1"/>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/><cols>${columnDefinitions}</cols>
  <sheetData>
    <row r="1" ht="25" customHeight="1">${buildExcelCell({ reference: "A1", value: title, style: 1 })}</row>
    <row r="2" ht="30" customHeight="1">${buildExcelCell({ reference: "A2", value: subtitle, style: 3 })}</row>
    <row r="4" ht="26" customHeight="1">${headerCells}</row>
    ${dataRows}${emptyRow}
  </sheetData>
  <autoFilter ref="A4:${lastColumnName}${lastDataRow}"/>
  <mergeCells count="${data.length ? 2 : 3}"><mergeCell ref="A1:${lastColumnName}1"/><mergeCell ref="A2:${lastColumnName}2"/>${
    data.length ? "" : `<mergeCell ref="A5:${lastColumnName}5"/>`
  }</mergeCells>
  <printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
};

const buildSummaryWorksheet = ({
  title,
  generatedAt,
  filterText,
  metrics,
  trend,
  trendColumns,
  note,
}) => {
  const metricLabels = metrics
    .map((metric, index) =>
      buildExcelCell({
        reference: `${getExcelColumnName(index + 1)}6`,
        value: metric.label,
        style: 12,
      }),
    )
    .join("");
  const metricValues = metrics
    .map((metric, index) =>
      buildExcelCell({
        reference: `${getExcelColumnName(index + 1)}7`,
        value: metric.value,
        style: metric.type === "currency" ? 15 : 14,
        numeric: true,
      }),
    )
    .join("");
  const trendRows = trend
    .map((entry, index) => {
      const row = index + 11;
      const alternate = index % 2 === 1;
      const valueCells = trendColumns.map((column, columnIndex) =>
        buildExcelCell({
          reference: `${getExcelColumnName(columnIndex + 2)}${row}`,
          value: entry[column.key],
          style: getExcelCellStyle(column, alternate),
          numeric: ["currency", "number"].includes(column.type),
        }),
      ).join("");
      return `<row r="${row}" ht="21" customHeight="1">${buildExcelCell({
        reference: `A${row}`,
        value: formatPeriod(entry.period),
        style: alternate ? 6 : 5,
      })}${valueCells}</row>`;
    })
    .join("");
  const trendHeaders = trendColumns.map((column, index) =>
    buildExcelCell({
      reference: `${getExcelColumnName(index + 2)}10`,
      value: column.label,
      style: 4,
    }),
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="19" customWidth="1"/><col min="2" max="2" width="19" customWidth="1"/><col min="3" max="4" width="22" customWidth="1"/><col min="5" max="5" width="3" customWidth="1"/><col min="6" max="14" width="12" customWidth="1"/></cols>
  <sheetData>
    <row r="1" ht="27" customHeight="1">${buildExcelCell({ reference: "A1", value: title, style: 1 })}</row>
    <row r="2" ht="20" customHeight="1">${buildExcelCell({ reference: "A2", value: `Dibuat pada ${generatedAt}`, style: 2 })}</row>
    <row r="3" ht="30" customHeight="1">${buildExcelCell({ reference: "A3", value: filterText, style: 3 })}</row>
    <row r="5" ht="22" customHeight="1">${buildExcelCell({ reference: "A5", value: "Ringkasan", style: 13 })}</row>
    <row r="6" ht="22" customHeight="1">${metricLabels}</row>
    <row r="7" ht="30" customHeight="1">${metricValues}</row>
    <row r="8" ht="24" customHeight="1">${buildExcelCell({ reference: "A8", value: note, style: 3 })}</row>
    <row r="9" ht="22" customHeight="1">${buildExcelCell({ reference: "A9", value: "Tren bulanan", style: 13 })}</row>
    <row r="10" ht="24" customHeight="1">${buildExcelCell({ reference: "A10", value: "Periode", style: 4 })}${trendHeaders}</row>
    ${trendRows || `<row r="11" ht="24" customHeight="1">${buildExcelCell({ reference: "A11", value: "Belum ada transaksi aktif.", style: 11 })}</row>`}
  </sheetData>
  <mergeCells count="5"><mergeCell ref="A1:N1"/><mergeCell ref="A2:N2"/><mergeCell ref="A3:N3"/><mergeCell ref="A5:D5"/><mergeCell ref="A8:D8"/></mergeCells>
  <printOptions horizontalCentered="1"/><pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="1"/>
  ${trend.length ? '<drawing r:id="rId1"/>' : ""}
</worksheet>`;
};

const buildChartXml = ({ trendLength, title, trendColumns }) => {
  const lastRow = 10 + trendLength;
  const chartColumns = trendColumns.filter(
    (column) => column.chart !== false,
  );
  const series = chartColumns.map((column, index) => {
    const worksheetColumn = getExcelColumnName(
      trendColumns.indexOf(column) + 2,
    );
    return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:v>${escapeXml(column.label)}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="${column.color || "365F9D"}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr><c:cat><c:strRef><c:f>'Ringkasan'!$A$11:$A$${lastRow}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>'Ringkasan'!$${worksheetColumn}$11:$${worksheetColumn}$${lastRow}</c:f></c:numRef></c:val></c:ser>`;
  }).join("");
  const numberFormat = chartColumns.some(
    (column) => column.type === "currency",
  ) ? "Rp #,##0" : "#,##0";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="id-ID" sz="1100" b="1"/><a:t>${escapeXml(title)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}<c:gapWidth val="70"/><c:axId val="53218816"/><c:axId val="53220352"/></c:barChart><c:catAx><c:axId val="53218816"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="53220352"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="53220352"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="${numberFormat}" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="53218816"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx></c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
};

const createExcelReport = ({
  title,
  filters,
  columns,
  rows,
  group,
}) => {
  const presentation = buildReportPresentation(rows, group);
  const generatedAt = new Date().toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  });
  const filterText = filters
    .map(({ label, value }) => `${label}: ${value}`)
    .join(" | ");
  const chartColumns = presentation.trendColumns.filter(
    (column) => column.chart !== false,
  );
  const hasChart =
    presentation.trend.length > 0 && chartColumns.length > 0;
  const chartEndColumn = Math.min(
    13,
    Math.max(10, 7 + presentation.trend.length),
  );
  const excelConfig = group.excel || {};
  const primarySheetName =
    excelConfig.primarySheetName || "Transaksi";
  const detailSheetName =
    excelConfig.detailSheetName || "Rincian Item";
  const detailRows = group.detailFilter
    ? rows.filter(group.detailFilter)
    : rows;
  const summarySheet = buildSummaryWorksheet({
    title,
    generatedAt,
    filterText,
    metrics: presentation.metrics,
    trend: presentation.trend,
    trendColumns: presentation.trendColumns,
    note:
      group.summary.note ||
      "Nilai dan kuantitas aktif tidak menghitung transaksi yang dibatalkan.",
  });
  const transactionSheet = buildTableWorksheet({
    title: `${title} - ${primarySheetName}`,
    subtitle:
      excelConfig.primaryDescription ||
      "Satu baris mewakili satu transaksi. Total dapat dijumlahkan tanpa duplikasi item.",
    columns: group.transactionColumns,
    data: presentation.transactions,
    contextForRow: (transaction) => ({ groupRows: transaction.rows }),
  });
  const detailSheet = buildTableWorksheet({
    title: `${title} - ${detailSheetName}`,
    subtitle:
      excelConfig.detailDescription ||
      "Satu baris mewakili satu produk. Gunakan filter header untuk menelusuri data.",
    columns,
    data: detailRows,
  });
  const now = new Date().toISOString();
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hasChart ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>' : ""}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(title)}</dc:title><dc:creator>SupplyFlow</dc:creator><cp:lastModifiedBy>SupplyFlow</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`,
    "docProps/app.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>SupplyFlow</Application><TitlesOfParts><vt:vector size="3" baseType="lpstr"><vt:lpstr>Ringkasan</vt:lpstr><vt:lpstr>${escapeXml(primarySheetName)}</vt:lpstr><vt:lpstr>${escapeXml(detailSheetName)}</vt:lpstr></vt:vector></TitlesOfParts></Properties>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Ringkasan" sheetId="1" r:id="rId1"/><sheet name="${escapeXml(primarySheetName)}" sheetId="2" r:id="rId2"/><sheet name="${escapeXml(detailSheetName)}" sheetId="3" r:id="rId3"/></sheets><calcPr calcId="191029"/></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;Rp&quot; #,##0"/><numFmt numFmtId="165" formatCode="#,##0.##"/></numFmts><fonts count="6"><font><sz val="10"/><color rgb="FF344054"/><name val="Arial"/></font><font><b/><sz val="16"/><color rgb="FF101828"/><name val="Arial"/></font><font><sz val="10"/><color rgb="FF667085"/><name val="Arial"/></font><font><i/><sz val="9"/><color rgb="FF475467"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FF174276"/><name val="Arial"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF365F9D"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F5FA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="hair"><color rgb="FFE4E7EC"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="16"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="4" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="165" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="5" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="165" fontId="5" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="164" fontId="5" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    "xl/worksheets/sheet1.xml": summarySheet,
    "xl/worksheets/sheet2.xml": transactionSheet,
    "xl/worksheets/sheet3.xml": detailSheet,
  };

  if (hasChart) {
    files["xl/worksheets/_rels/sheet1.xml.rels"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`;
    files["xl/drawings/drawing1.xml"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>4</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${chartEndColumn}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>18</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="${escapeXml(group.summary.chartTitle)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`;
    files["xl/drawings/_rels/drawing1.xml.rels"] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>`;
    files["xl/charts/chart1.xml"] = buildChartXml({
      trendLength: presentation.trend.length,
      title: group.summary.chartTitle,
      trendColumns: presentation.trendColumns,
    });
  }

  const archive = zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, content]) => [
        path,
        strToU8(content),
      ]),
    ),
    { level: 6 },
  );
  return Buffer.from(archive);
};

const createPdfReport = ({ title, filters, rows, group }) =>
  new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 36,
      bufferPages: true,
      info: { Title: title, Author: "SupplyFlow" },
    });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    const pageWidth =
      document.page.width -
      document.page.margins.left -
      document.page.margins.right;
    const pageBottom = () =>
      document.page.height - document.page.margins.bottom - 22;
    const presentation = buildReportPresentation(rows, group);
    const generatedAt = new Date().toLocaleString("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    });
    const configuredWidth = group.itemColumns.reduce(
      (total, column) => total + column.width,
      0,
    );
    const widthFactor = pageWidth / configuredWidth;
    const itemColumns = group.itemColumns.map((column) => ({
      ...column,
      renderedWidth: column.width * widthFactor,
    }));
    const chartColumns = presentation.trendColumns.filter(
      (column) => column.chart !== false,
    );
    const pdfConfig = group.pdf || {};

    const ensureSpace = (height) => {
      if (document.y + height <= pageBottom()) return false;
      document.addPage();
      return true;
    };

    const drawDocumentHeading = () => {
      document.fillColor("#101828").font("Helvetica-Bold").fontSize(17).text(title);
      document.moveDown(0.2).fillColor("#667085").font("Helvetica").fontSize(8).text(`Dibuat pada ${generatedAt}`);
      document.moveDown(0.35).fillColor("#475467").fontSize(7.5).text(
        filters.map(({ label, value }) => `${label}: ${value}`).join("   |   "),
        { width: pageWidth },
      );
      document.moveDown(0.65);
    };

    const drawSummary = () => {
      const startX = document.page.margins.left;
      const startY = document.y;
      const gap = 8;
      const width =
        (pageWidth - gap * (presentation.metrics.length - 1)) /
        presentation.metrics.length;
      presentation.metrics.forEach((metric, index) => {
        const x = startX + index * (width + gap);
        document.roundedRect(x, startY, width, 48, 5).fillAndStroke("#F8FAFC", "#E4E7EC");
        document.fillColor("#667085").font("Helvetica").fontSize(7.5).text(metric.label, x + 9, startY + 8, { width: width - 18 });
        document.fillColor("#101828").font("Helvetica-Bold").fontSize(12).text(formatDisplayValue(metric.value, metric.type), x + 9, startY + 23, { width: width - 18 });
      });
      document.x = startX;
      document.y = startY + 57;
      document.fillColor("#667085").font("Helvetica-Oblique").fontSize(7).text(
        group.summary.note ||
        "Nilai dan kuantitas aktif tidak menghitung transaksi yang dibatalkan.",
      );
      document.moveDown(0.65);
    };

    const drawTrendChart = () => {
      const startX = document.page.margins.left;
      const startY = document.y;
      const chartHeight = 102;
      const plotX = startX + 48;
      const plotY = startY + 18;
      const plotWidth = pageWidth - 60;
      const plotHeight = chartHeight - 36;
      const trend = presentation.trend.slice(-12);
      document.x = startX;
      document.fillColor("#344054").font("Helvetica-Bold").fontSize(9).text(group.summary.chartTitle, startX, startY);

      if (!trend.length) {
        document.roundedRect(startX, plotY, pageWidth, plotHeight, 4).fillAndStroke("#F8FAFC", "#E4E7EC");
        document.fillColor("#98A2B3").font("Helvetica").fontSize(8).text(
          group.summary.emptyTrendLabel ||
          "Belum ada transaksi aktif untuk ditampilkan pada tren.",
          startX,
          plotY + plotHeight / 2 - 4,
          { width: pageWidth, align: "center" },
        );
        document.x = startX;
        document.y = startY + chartHeight + 6;
        return;
      }

      const maxValue = Math.max(
        ...trend.flatMap((entry) =>
          chartColumns.map((column) => Number(entry[column.key]) || 0),
        ),
        1,
      );
      const labelFormatter = chartColumns.some(
        (column) => column.type === "currency",
      ) ? formatCompactCurrency : formatNumber;
      for (let index = 0; index <= 2; index += 1) {
        const ratio = index / 2;
        const y = plotY + plotHeight * ratio;
        document.moveTo(plotX, y).lineTo(plotX + plotWidth, y).strokeColor("#E4E7EC").lineWidth(0.6).stroke();
        document.fillColor("#98A2B3").font("Helvetica").fontSize(6).text(labelFormatter(maxValue * (1 - ratio)), startX, y - 3, { width: 42, align: "right", lineBreak: false });
      }
      const slotWidth = Math.min(
        plotWidth / trend.length,
        92,
      );
      const groupWidth = Math.min(slotWidth * 0.68, 54);
      const barWidth = groupWidth / Math.max(chartColumns.length, 1);
      trend.forEach((entry, index) => {
        const groupX =
          plotX + 8 + index * slotWidth;
        chartColumns.forEach((column, seriesIndex) => {
          const value = Number(entry[column.key]) || 0;
          const height = (value / maxValue) * (plotHeight - 4);
          const x = groupX + seriesIndex * barWidth;
          const y = plotY + plotHeight - height;
          if (height > 0) {
            document.roundedRect(
              x,
              y,
              Math.max(barWidth - 1, 1),
              height,
              1.5,
            ).fill(`#${column.color || "365F9D"}`);
          }
        });
        document.fillColor("#667085").font("Helvetica").fontSize(6).text(formatPeriod(entry.period), groupX - 8, plotY + plotHeight + 5, { width: groupWidth + 16, align: "center", lineBreak: false });
      });
      let legendX = startX + Math.min(210, pageWidth * 0.35);
      chartColumns.forEach((column) => {
        document.rect(legendX, startY + 2, 7, 7)
          .fill(`#${column.color || "365F9D"}`);
        document.fillColor("#667085").font("Helvetica").fontSize(6.5)
          .text(column.label, legendX + 10, startY + 1, {
            lineBreak: false,
          });
        legendX += 16 + document.widthOfString(column.label);
      });
      document.x = startX;
      document.y = startY + chartHeight + 8;
    };

    const drawSectionHeading = () => {
      ensureSpace(35);
      document.x = document.page.margins.left;
      document.fillColor("#101828").font("Helvetica-Bold").fontSize(11).text(
        pdfConfig.sectionTitle || "Rincian transaksi",
      );
      document.moveDown(0.2).fillColor("#667085").font("Helvetica").fontSize(7).text(
        pdfConfig.sectionDescription ||
        "Setiap bagian menampilkan identitas transaksi dan daftar produknya.",
      );
      document.moveDown(0.7);
    };

    const drawGroupHeading = (firstRow, continuation) => {
      ensureSpace(98);
      const startX = document.page.margins.left;
      const startY = document.y;
      const metaGap = 8;
      const availableWidth = pageWidth - 16;
      const totalWeight = group.meta.reduce(
        (total, meta) => total + (meta.width || 1),
        0,
      );
      let x = startX + 8;
      document.rect(startX, startY, pageWidth, 52)
        .fillAndStroke("#F1F5FA", "#E4E7EC");
      document.fillColor("#174276").font("Helvetica-Bold").fontSize(9).text(`${group.label}: ${firstRow[group.key]}${continuation ? " (lanjutan)" : ""}`, startX + 8, startY + 7, { width: pageWidth - 16, lineBreak: false, ellipsis: true });
      group.meta.forEach((meta) => {
        const width = ((availableWidth - metaGap * (group.meta.length - 1)) * (meta.width || 1)) / totalWeight;
        document.fillColor("#98A2B3").font("Helvetica").fontSize(6).text(meta.label.toLocaleUpperCase("id-ID"), x, startY + 25, { width, lineBreak: false });
        const rawValue = meta.value(firstRow);
        const displayValue = typeof meta.format === "function"
          ? meta.format(rawValue, firstRow)
          : formatDisplayValue(rawValue, meta.type);
        document.fillColor("#344054").font("Helvetica-Bold").fontSize(7).text(displayValue, x, startY + 36, { width, lineBreak: false, ellipsis: true });
        x += width + metaGap;
      });
      document.y = startY + 52;
    };

    const drawTableHeader = () => {
      const startX = document.page.margins.left;
      const startY = document.y;
      let x = startX;
      itemColumns.forEach((column) => {
        document.rect(x, startY, column.renderedWidth, 22).fillAndStroke("#365F9D", "#365F9D");
        document.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(6.5).text(column.label, x + 4, startY + 7, { width: column.renderedWidth - 8, align: column.align || "left", lineBreak: false, ellipsis: true });
        x += column.renderedWidth;
      });
      document.y = startY + 22;
    };

    const drawItemRow = (row, rowIndex, firstRow) => {
      const values = itemColumns.map((column) =>
        formatDisplayValue(getColumnValue(row, column), column.type),
      );
      const rowHeight = Math.max(
        22,
        ...values.map((value, index) =>
          document.heightOfString(value, {
            width: itemColumns[index].renderedWidth - 8,
            lineGap: 1,
          }) + 9,
        ),
      );
      if (ensureSpace(rowHeight)) {
        drawGroupHeading(firstRow, true);
        drawTableHeader();
      }
      const startX = document.page.margins.left;
      const startY = document.y;
      let x = startX;
      const fill = rowIndex % 2 ? "#F8FAFC" : "#FFFFFF";
      itemColumns.forEach((column, index) => {
        document.rect(x, startY, column.renderedWidth, rowHeight).fillAndStroke(fill, "#E4E7EC");
        document.fillColor("#344054").font("Helvetica").fontSize(6.5).text(values[index], x + 4, startY + 5, { width: column.renderedWidth - 8, height: rowHeight - 8, align: column.align || "left", ellipsis: true, lineGap: 1 });
        x += column.renderedWidth;
      });
      document.y = startY + rowHeight;
    };

    drawDocumentHeading();
    drawSummary();
    drawTrendChart();
    drawSectionHeading();

    if (!rows.length) {
      document.fillColor("#667085").font("Helvetica-Oblique").fontSize(10).text("Tidak ada data yang sesuai dengan filter.", { align: "center" });
    } else {
      presentation.groupedRows.forEach((groupRows, groupIndex) => {
        if (groupIndex) document.y += 14;
        drawGroupHeading(groupRows[0], false);
        const detailRows = group.detailFilter
          ? groupRows.filter(group.detailFilter)
          : groupRows;
        if (detailRows.length) {
          drawTableHeader();
          detailRows.forEach((row, rowIndex) =>
            drawItemRow(row, rowIndex, groupRows[0]),
          );
        } else {
          const startX = document.page.margins.left;
          const startY = document.y;
          document.rect(startX, startY, pageWidth, 24)
            .fillAndStroke("#FFFFFF", "#E4E7EC");
          document.fillColor("#667085").font("Helvetica-Oblique")
            .fontSize(7.5).text(
              pdfConfig.emptyDetailLabel || "Tidak ada rincian.",
              startX,
              startY + 8,
              { width: pageWidth, align: "center" },
            );
          document.y = startY + 24;
        }
      });
    }

    const pageRange = document.bufferedPageRange();
    for (
      let pageIndex = pageRange.start;
      pageIndex < pageRange.start + pageRange.count;
      pageIndex += 1
    ) {
      document.switchToPage(pageIndex);
      const footerY =
        document.page.height - document.page.margins.bottom - 10;
      document.fillColor("#98A2B3").font("Helvetica").fontSize(7).text(
        `SupplyFlow  |  Halaman ${pageIndex - pageRange.start + 1} dari ${pageRange.count}`,
        document.page.margins.left,
        footerY,
        { width: pageWidth, align: "right", lineBreak: false },
      );
    }
    document.end();
  });

const buildExportFileName = (reportName, format) =>
  `laporan-${reportName}-${new Date().toISOString().slice(0, 10)}.${format}`;

module.exports = {
  EXCEL_MIME_TYPE,
  PDF_MIME_TYPE,
  buildExportFileName,
  createExcelReport,
  createPdfReport,
  formatNumber,
  formatStatus,
};
