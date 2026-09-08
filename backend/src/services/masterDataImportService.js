const { strFromU8, strToU8, unzipSync, zipSync } = require("fflate");
const {
  resolveCodeNumber,
} = require("./codeNumberService");

const MAX_IMPORT_ROWS = 500;
const MAX_UNCOMPRESSED_BYTES = 10 * 1024 * 1024;
const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const IMPORT_MODULES = Object.freeze({
  categories: {
    key: "categories",
    label: "Categories",
    singularLabel: "kategori",
    moduleKey: "CATEGORY",
    codeField: "category_code",
    fields: [
      { key: "category_code", label: "Kode kategori", optional: true },
      { key: "category_name", label: "Nama kategori", required: true },
    ],
    example: {
      category_code: "",
      category_name: "Perlengkapan Kebersihan",
    },
  },
  suppliers: {
    key: "suppliers",
    label: "Suppliers",
    singularLabel: "supplier",
    moduleKey: "SUPPLIER",
    codeField: "supplier_code",
    fields: [
      { key: "supplier_code", label: "Kode supplier", optional: true },
      { key: "supplier_name", label: "Nama supplier", required: true },
      { key: "contact_person", label: "Kontak" },
      { key: "phone", label: "Telepon" },
      { key: "email", label: "Email" },
      { key: "address", label: "Alamat" },
      { key: "city", label: "Kota" },
      { key: "payment_terms_days", label: "Termin (hari)", type: "number" },
      { key: "payment_scheme", label: "Skema pembayaran" },
      { key: "down_payment_percent", label: "DP (%)", type: "number" },
      { key: "notes", label: "Catatan" },
    ],
    example: {
      supplier_code: "",
      supplier_name: "PT Contoh Supplier",
      contact_person: "Budi",
      phone: "081234567890",
      email: "budi@contoh.co.id",
      address: "Jl. Contoh No. 10",
      city: "Jakarta",
      payment_terms_days: 30,
      payment_scheme: "TERM",
      down_payment_percent: "",
      notes: "Baris contoh, hapus sebelum impor",
    },
  },
  products: {
    key: "products",
    label: "Products",
    singularLabel: "produk",
    moduleKey: "PRODUCT",
    codeField: "sku",
    fields: [
      { key: "sku", label: "SKU", optional: true },
      { key: "product_name", label: "Nama produk", required: true },
      { key: "category_code", label: "Kode kategori", required: true },
      { key: "supplier_code", label: "Kode supplier", required: true },
      { key: "unit", label: "Satuan" },
      { key: "purchase_price", label: "Harga beli", type: "number" },
      { key: "selling_price", label: "Harga jual", type: "number" },
      { key: "minimum_stock", label: "Stok minimum", type: "number" },
      { key: "description", label: "Deskripsi" },
    ],
    example: {
      sku: "",
      product_name: "Produk Contoh",
      category_code: "CAT-0001",
      supplier_code: "SUP-0001",
      unit: "PCS",
      purchase_price: 10000,
      selling_price: 15000,
      minimum_stock: 5,
      description: "Baris contoh, hapus sebelum impor",
    },
  },
  customers: {
    key: "customers",
    label: "Customers",
    singularLabel: "customer",
    moduleKey: "CUSTOMER",
    codeField: "customer_code",
    fields: [
      { key: "customer_code", label: "Kode customer", optional: true },
      { key: "customer_name", label: "Nama customer", required: true },
      { key: "contact_person", label: "Kontak" },
      { key: "phone", label: "Telepon" },
      { key: "email", label: "Email" },
      { key: "address", label: "Alamat" },
      { key: "city", label: "Kota" },
      { key: "payment_terms_days", label: "Termin (hari)", type: "number" },
      { key: "credit_limit", label: "Limit kredit", type: "number" },
      { key: "notes", label: "Catatan" },
    ],
    example: {
      customer_code: "",
      customer_name: "Toko Contoh",
      contact_person: "Siti",
      phone: "081234567891",
      email: "siti@contoh.co.id",
      address: "Jl. Pelanggan No. 5",
      city: "Bandung",
      payment_terms_days: 14,
      credit_limit: 5000000,
      notes: "Baris contoh, hapus sebelum impor",
    },
  },
});

const getDefinition = (moduleValue) => {
  const key = typeof moduleValue === "string"
    ? moduleValue.trim().toLowerCase()
    : "";
  const definition = IMPORT_MODULES[key];
  if (!definition) {
    const error = new Error("Modul impor tidak valid");
    error.statusCode = 400;
    throw error;
  }
  return definition;
};

const escapeXml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

const decodeXml = (value) => String(value ?? "")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&gt;/g, ">")
  .replace(/&lt;/g, "<")
  .replace(/&amp;/g, "&");

const columnName = (index) => {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
};

const columnIndex = (reference) => {
  const letters = String(reference).match(/[A-Z]+/i)?.[0] || "A";
  return [...letters.toUpperCase()].reduce(
    (total, letter) => total * 26 + letter.charCodeAt(0) - 64,
    0,
  ) - 1;
};

const buildCell = (value, reference, style = 0) => {
  if (typeof value === "number") {
    return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  }
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
};

const buildTemplateWorkbook = (moduleValue) => {
  const definition = getDefinition(moduleValue);
  const headers = definition.fields.map((field) => field.key);
  const labels = definition.fields.map((field) =>
    `${field.label}${field.required ? " *" : field.optional ? " (opsional bila otomatis)" : ""}`,
  );
  const example = definition.fields.map((field) => definition.example[field.key] ?? "");
  const rows = [headers, labels, example];
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, index) =>
      buildCell(value, `${columnName(index)}${rowIndex + 1}`, rowIndex === 0 ? 1 : rowIndex === 1 ? 2 : 0),
    ).join("");
    return `<row r="${rowIndex + 1}" ht="${rowIndex === 1 ? 34 : 22}" customHeight="1">${cells}</row>`;
  }).join("");
  const columns = definition.fields.map((field, index) => {
    const width = Math.min(34, Math.max(14, field.label.length + 5));
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");
  const lastColumn = columnName(headers.length - 1);
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${lastColumn}3"/></worksheet>`;
  const now = new Date().toISOString();
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Template Import ${escapeXml(definition.label)}</dc:title><dc:creator>SupplyFlow</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`,
    "docProps/app.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>SupplyFlow</Application></Properties>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Import ${escapeXml(definition.label)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="10"/><color rgb="FF334155"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><i/><sz val="9"/><color rgb="FF475569"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    "xl/worksheets/sheet1.xml": worksheet,
  };
  const archive = zipSync(
    Object.fromEntries(Object.entries(files).map(([name, content]) => [name, strToU8(content)])),
    { level: 6 },
  );
  return {
    buffer: Buffer.from(archive),
    fileName: `template-import-${definition.key}.xlsx`,
    mimeType: EXCEL_MIME_TYPE,
  };
};

const readTextEntry = (entries, name) => {
  const value = entries[name];
  return value ? strFromU8(value) : "";
};

const parseSharedStrings = (xml) => {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((textMatch) => decodeXml(textMatch[1]))
      .join(""),
  );
};

const parseCellValue = (cellXml, type, sharedStrings) => {
  if (type === "inlineStr") {
    return [...cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((match) => decodeXml(match[1]))
      .join("");
  }
  const raw = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
  if (raw === undefined) return "";
  if (type === "s") return sharedStrings[Number(raw)] ?? "";
  if (type === "str") return decodeXml(raw);
  const numeric = Number(raw);
  return raw !== "" && Number.isFinite(numeric) ? numeric : decodeXml(raw);
};

const parseWorkbook = (buffer) => {
  let entries;
  try {
    entries = unzipSync(new Uint8Array(buffer));
  } catch {
    const error = new Error("File tidak dapat dibaca sebagai workbook Excel (.xlsx)");
    error.statusCode = 400;
    throw error;
  }
  const totalBytes = Object.values(entries).reduce((sum, entry) => sum + entry.length, 0);
  if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
    const error = new Error("Isi workbook terlalu besar");
    error.statusCode = 400;
    throw error;
  }
  const sheetXml = readTextEntry(entries, "xl/worksheets/sheet1.xml");
  if (!sheetXml) {
    const error = new Error("Sheet pertama tidak ditemukan");
    error.statusCode = 400;
    throw error;
  }
  const sharedStrings = parseSharedStrings(readTextEntry(entries, "xl/sharedStrings.xml"));
  return [...sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)].map((rowMatch, rowPosition) => {
    const rowNumber = Number(rowMatch[1].match(/\br="(\d+)"/)?.[1] || rowPosition + 1);
    const values = [];
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)(?:>([\s\S]*?)<\/c>|\/\s*>)/g)) {
      const attributes = cellMatch[1] || "";
      const reference = attributes.match(/\br="([A-Z]+\d+)"/i)?.[1] || `A${rowNumber}`;
      const type = attributes.match(/\bt="([^"]+)"/)?.[1] || "";
      values[columnIndex(reference)] = parseCellValue(cellMatch[2] || "", type, sharedStrings);
    }
    return { rowNumber, values };
  });
};

const cleanString = (value) => value === null || value === undefined
  ? ""
  : String(value).trim();
const cleanCode = (value) => cleanString(value).toUpperCase();
const isBlankRow = (row) => row.every((value) => cleanString(value) === "");

const parseImportRows = (buffer, moduleValue) => {
  const definition = getDefinition(moduleValue);
  const workbookRows = parseWorkbook(buffer);
  if (workbookRows.length === 0) {
    const error = new Error("Workbook tidak memiliki data");
    error.statusCode = 400;
    throw error;
  }
  const expectedHeaders = definition.fields.map((field) => field.key);
  const header = workbookRows[0].values.map((value) => cleanString(value).toLowerCase());
  const missingHeaders = expectedHeaders.filter((key) => !header.includes(key));
  if (missingHeaders.length > 0) {
    const error = new Error(`Kolom template tidak lengkap: ${missingHeaders.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
  const headerIndex = Object.fromEntries(expectedHeaders.map((key) => [key, header.indexOf(key)]));
  const isUntouchedExample = (row) => definition.fields.every((field) =>
    cleanString(row.values[headerIndex[field.key]]) === cleanString(definition.example[field.key]),
  );
  const dataRows = workbookRows.slice(1).filter((row) => {
    const firstCell = cleanString(row.values[0]).toLowerCase();
    return firstCell !== "kode kategori (opsional bila otomatis)" &&
      firstCell !== "kode supplier (opsional bila otomatis)" &&
      firstCell !== "sku (opsional bila otomatis)" &&
      firstCell !== "kode customer (opsional bila otomatis)" &&
      !isUntouchedExample(row) &&
      !isBlankRow(row.values);
  });
  if (dataRows.length > MAX_IMPORT_ROWS) {
    const error = new Error(`Maksimal ${MAX_IMPORT_ROWS} baris per impor`);
    error.statusCode = 400;
    throw error;
  }
  return dataRows.map((row) => ({
    row_number: row.rowNumber,
    data: Object.fromEntries(definition.fields.map((field) => [field.key, row.values[headerIndex[field.key]] ?? ""])),
  }));
};

const numberValue = (value, fieldLabel, errors, { integer = false, max = null } = {}) => {
  if (value === "" || value === null || value === undefined) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed))) {
    errors.push(`${fieldLabel} harus berupa angka ${integer ? "bulat " : ""}tidak negatif`);
    return 0;
  }
  if (max !== null && parsed > max) errors.push(`${fieldLabel} maksimal ${max}`);
  return parsed;
};

const normalizeRow = (definition, input) => {
  const row = {};
  definition.fields.forEach((field) => {
    row[field.key] = field.type === "number"
      ? input[field.key]
      : cleanString(input[field.key]);
  });
  row[definition.codeField] = cleanCode(row[definition.codeField]);
  if (definition.key === "products") {
    row.category_code = cleanCode(row.category_code);
    row.supplier_code = cleanCode(row.supplier_code);
    row.unit = cleanCode(row.unit) || "PCS";
  }
  if (definition.key === "suppliers") row.payment_scheme = cleanCode(row.payment_scheme);
  return row;
};

const validateShape = (definition, row) => {
  const errors = [];
  definition.fields.filter((field) => field.required).forEach((field) => {
    if (!cleanString(row[field.key])) errors.push(`${field.label} wajib diisi`);
  });
  const email = cleanString(row.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Format email tidak valid");
  const codeLimit = definition.key === "products" ? 50 : 30;
  if (row[definition.codeField]?.length > codeLimit) {
    errors.push(`${definition.fields[0].label} maksimal ${codeLimit} karakter`);
  }
  if (definition.key === "suppliers") {
    row.payment_terms_days = numberValue(row.payment_terms_days, "Termin pembayaran", errors, { integer: true, max: 365 });
    if (row.payment_scheme && !["DIRECT", "TERM", "DOWN_PAYMENT", "COD"].includes(row.payment_scheme)) {
      errors.push("Skema pembayaran harus DIRECT, TERM, DOWN_PAYMENT, atau COD");
    }
    const rawDownPayment = row.down_payment_percent;
    row.down_payment_percent = rawDownPayment === "" || rawDownPayment === null || rawDownPayment === undefined
      ? null
      : numberValue(rawDownPayment, "DP", errors, { max: 100 });
  }
  if (definition.key === "customers") {
    row.payment_terms_days = numberValue(row.payment_terms_days, "Termin pembayaran", errors, { integer: true });
    row.credit_limit = numberValue(row.credit_limit, "Limit kredit", errors);
  }
  if (definition.key === "products") {
    row.purchase_price = numberValue(row.purchase_price, "Harga beli", errors);
    row.selling_price = numberValue(row.selling_price, "Harga jual", errors);
    row.minimum_stock = numberValue(row.minimum_stock, "Stok minimum", errors);
  }
  return errors;
};

const loadReferences = async (queryable, definition) => {
  const references = { codes: new Set(), names: new Set(), isAutomatic: false };
  const codeQueries = {
    categories: "SELECT UPPER(category_code) AS code FROM app.categories",
    suppliers: "SELECT UPPER(supplier_code) AS code FROM app.suppliers",
    products: "SELECT UPPER(sku) AS code FROM app.products",
    customers: "SELECT UPPER(customer_code) AS code FROM app.customers",
  };
  const codeResult = await queryable.query(codeQueries[definition.key]);
  references.codes = new Set(codeResult.rows.map((row) => row.code));
  const settingResult = await queryable.query(
    "SELECT is_automatic FROM app.code_number_settings WHERE module_key = $1",
    [definition.moduleKey],
  );
  references.isAutomatic = Boolean(settingResult.rows[0]?.is_automatic);
  if (definition.key === "categories") {
    const names = await queryable.query(
      "SELECT LOWER(category_name) AS name FROM app.categories",
    );
    references.names = new Set(names.rows.map((row) => row.name));
  }
  if (definition.key === "products") {
    const [categories, suppliers] = await Promise.all([
      queryable.query("SELECT id, UPPER(category_code) AS code FROM app.categories WHERE status = 'ACTIVE'"),
      queryable.query("SELECT id, UPPER(supplier_code) AS code FROM app.suppliers WHERE status = 'ACTIVE'"),
    ]);
    references.categories = new Map(categories.rows.map((row) => [row.code, row.id]));
    references.suppliers = new Map(suppliers.rows.map((row) => [row.code, row.id]));
  }
  return references;
};

const validateRows = async (queryable, moduleValue, inputRows) => {
  const definition = getDefinition(moduleValue);
  if (!Array.isArray(inputRows) || inputRows.length === 0) {
    const error = new Error("Tidak ada baris data untuk divalidasi");
    error.statusCode = 400;
    throw error;
  }
  if (inputRows.length > MAX_IMPORT_ROWS) {
    const error = new Error(`Maksimal ${MAX_IMPORT_ROWS} baris per impor`);
    error.statusCode = 400;
    throw error;
  }
  const references = await loadReferences(queryable, definition);
  const seenCodes = new Set();
  const seenNames = new Set();
  const validated = inputRows.map((item, index) => {
    const rowNumber = Number(item.row_number) || index + 2;
    const row = normalizeRow(definition, item.data || item);
    const errors = validateShape(definition, row);
    const code = row[definition.codeField];
    if (!code && !references.isAutomatic) {
      errors.push(`${definition.fields[0].label} wajib diisi karena penomoran otomatis nonaktif`);
    }
    if (code) {
      if (seenCodes.has(code)) errors.push(`${definition.fields[0].label} duplikat di file`);
      if (references.codes.has(code)) errors.push(`${definition.fields[0].label} sudah digunakan`);
      seenCodes.add(code);
    }
    if (definition.key === "categories") {
      const name = row.category_name.toLowerCase();
      if (seenNames.has(name)) errors.push("Nama kategori duplikat di file");
      if (references.names.has(name)) errors.push("Nama kategori sudah digunakan");
      seenNames.add(name);
    }
    if (definition.key === "products") {
      const categoryId = references.categories.get(row.category_code);
      const supplierId = references.suppliers.get(row.supplier_code);
      if (!categoryId) errors.push("Kode kategori tidak ditemukan atau tidak aktif");
      if (!supplierId) errors.push("Kode supplier tidak ditemukan atau tidak aktif");
      row.category_id = categoryId || null;
      row.supplier_id = supplierId || null;
    }
    return { row_number: rowNumber, data: row, errors, valid: errors.length === 0 };
  });
  return {
    module: definition.key,
    rows: validated,
    summary: {
      total: validated.length,
      valid: validated.filter((row) => row.valid).length,
      invalid: validated.filter((row) => !row.valid).length,
    },
  };
};

const insertRow = async (client, definition, row) => {
  const code = await resolveCodeNumber({
    client,
    moduleKey: definition.moduleKey,
    manualCode: row[definition.codeField],
  });
  if (definition.key === "categories") {
    return client.query("INSERT INTO app.categories (category_code, category_name) VALUES ($1, $2) RETURNING id, category_code AS code", [code, row.category_name]);
  }
  if (definition.key === "suppliers") {
    return client.query(`INSERT INTO app.suppliers (supplier_code, supplier_name, contact_person, phone, email, address, city, payment_terms_days, payment_scheme, down_payment_percent, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, supplier_code AS code`, [code, row.supplier_name, row.contact_person || null, row.phone || null, row.email || null, row.address || null, row.city || null, row.payment_terms_days, row.payment_scheme || null, row.down_payment_percent, row.notes || null]);
  }
  if (definition.key === "customers") {
    return client.query(`INSERT INTO app.customers (customer_code, customer_name, contact_person, phone, email, address, city, payment_terms_days, credit_limit, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, customer_code AS code`, [code, row.customer_name, row.contact_person || null, row.phone || null, row.email || null, row.address || null, row.city || null, row.payment_terms_days, row.credit_limit, row.notes || null]);
  }
  return client.query(`INSERT INTO app.products (sku, product_name, category_id, supplier_id, unit, purchase_price, selling_price, minimum_stock, current_stock, description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9) RETURNING id, sku AS code`, [code, row.product_name, row.category_id, row.supplier_id, row.unit, row.purchase_price, row.selling_price, row.minimum_stock, row.description || null]);
};

const commitImport = async (pool, moduleValue, inputRows) => {
  const definition = getDefinition(moduleValue);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const validation = await validateRows(client, definition.key, inputRows);
    if (validation.summary.invalid > 0) {
      const error = new Error("Data berubah atau tidak valid. Periksa kembali pratinjau impor.");
      error.statusCode = 400;
      error.details = validation;
      throw error;
    }
    const inserted = [];
    for (const item of validation.rows) {
      const result = await insertRow(client, definition, item.data);
      inserted.push(result.rows[0]);
    }
    await client.query("COMMIT");
    return { module: definition.key, imported: inserted.length, items: inserted };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      error.statusCode = 409;
      error.message = "Kode pada salah satu baris sudah digunakan";
    }
    throw error;
  } finally {
    client.release();
  }
};

const listModules = () => Object.values(IMPORT_MODULES).map((definition) => ({
  key: definition.key,
  label: definition.label,
  fields: definition.fields,
  max_rows: MAX_IMPORT_ROWS,
}));

module.exports = {
  EXCEL_MIME_TYPE,
  MAX_IMPORT_ROWS,
  buildTemplateWorkbook,
  commitImport,
  getDefinition,
  listModules,
  parseImportRows,
  validateRows,
};
