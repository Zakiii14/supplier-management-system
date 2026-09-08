const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildTemplateWorkbook,
  parseImportRows,
  validateRows,
} = require("../src/services/masterDataImportService");

test("master data import templates are valid XLSX archives for every supported module", () => {
  for (const moduleKey of ["categories", "suppliers", "products", "customers"]) {
    const workbook = buildTemplateWorkbook(moduleKey);
    assert.equal(workbook.mimeType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assert.equal(workbook.buffer[0], 0x50);
    assert.equal(workbook.buffer[1], 0x4b);
    assert.match(workbook.fileName, new RegExp(moduleKey));
    assert.deepEqual(parseImportRows(workbook.buffer, moduleKey), []);
  }
});

test("master data import validation detects required fields and duplicates", async () => {
  const queryable = {
    async query(sql) {
      if (sql.includes("FROM app.categories") && sql.includes("category_code")) {
        return { rows: [{ code: "CAT-USED" }] };
      }
      if (sql.includes("code_number_settings")) {
        return { rows: [{ is_automatic: true }] };
      }
      if (sql.includes("LOWER(category_name)")) {
        return { rows: [{ name: "kategori lama" }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const result = await validateRows(queryable, "categories", [
    { row_number: 2, data: { category_code: "cat-used", category_name: "Kategori Baru" } },
    { row_number: 3, data: { category_code: "cat-used", category_name: "" } },
    { row_number: 4, data: { category_code: "", category_name: "Kategori Lama" } },
  ]);
  assert.deepEqual(result.summary, { total: 3, valid: 0, invalid: 3 });
  assert.ok(result.rows[0].errors.includes("Kode kategori sudah digunakan"));
  assert.ok(result.rows[1].errors.includes("Kode kategori duplikat di file"));
  assert.ok(result.rows[1].errors.includes("Nama kategori wajib diisi"));
  assert.ok(result.rows[2].errors.includes("Nama kategori sudah digunakan"));
});

test("manual numbering requires codes during import preview", async () => {
  const queryable = {
    async query(sql) {
      if (sql.includes("FROM app.customers")) return { rows: [] };
      if (sql.includes("code_number_settings")) return { rows: [{ is_automatic: false }] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const result = await validateRows(queryable, "customers", [
    { row_number: 2, data: { customer_name: "Toko Baru" } },
  ]);
  assert.equal(result.summary.invalid, 1);
  assert.match(result.rows[0].errors[0], /wajib diisi karena penomoran otomatis nonaktif/);
});
