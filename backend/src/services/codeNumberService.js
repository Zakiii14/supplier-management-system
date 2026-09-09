const MODULE_DEFINITIONS = Object.freeze({
  SUPPLIER: {
    table: "suppliers",
    column: "supplier_code",
    maxLength: 30,
  },
  CATEGORY: {
    table: "categories",
    column: "category_code",
    maxLength: 30,
  },
  PRODUCT: {
    table: "products",
    column: "sku",
    maxLength: 50,
  },
  PURCHASE_ORDER: {
    table: "purchase_orders",
    column: "po_number",
    maxLength: 40,
  },
  GOODS_RECEIPT: {
    table: "goods_receipts",
    column: "receipt_number",
    maxLength: 40,
  },
  CUSTOMER: {
    table: "customers",
    column: "customer_code",
    maxLength: 30,
  },
  SALES_ORDER: {
    table: "sales_orders",
    column: "so_number",
    maxLength: 40,
  },
  DELIVERY: {
    table: "deliveries",
    column: "delivery_number",
    maxLength: 40,
  },
  INVOICE: {
    table: "invoices",
    column: "invoice_number",
    maxLength: 40,
  },
  PAYMENT: {
    table: "payments",
    column: "payment_number",
    maxLength: 40,
  },
  SUPPLIER_PAYMENT: {
    table: "supplier_payments",
    column: "payment_number",
    maxLength: 40,
  },
  STOCK_OPNAME: {
    table: "stock_opnames",
    column: "opname_number",
    maxLength: 40,
  },
});

const normalizeModuleKey = (value) =>
  typeof value === "string"
    ? value.trim().toUpperCase()
    : "";

const normalizeManualCode = (value) =>
  typeof value === "string"
    ? value.trim().toUpperCase()
    : "";

const getPeriodKey = (setting) => {
  if (setting.reset_rule === "MONTHLY") {
    return `${setting.current_year}${setting.current_month}`;
  }

  if (setting.reset_rule === "YEARLY") {
    return setting.current_year;
  }

  return "GLOBAL";
};

const formatCode = (setting, sequenceNumber) => {
  const parts = [setting.prefix];

  if (setting.include_year) {
    parts.push(setting.current_year);
  }

  if (setting.include_month) {
    parts.push(setting.current_month);
  }

  parts.push(
    String(sequenceNumber).padStart(
      Number(setting.digit_length),
      "0",
    ),
  );

  return parts.join(setting.separator);
};

const getSetting = async (queryable, moduleKey) => {
  const normalizedModuleKey = normalizeModuleKey(moduleKey);

  if (!MODULE_DEFINITIONS[normalizedModuleKey]) {
    const error = new Error("Invalid numbering module");
    error.statusCode = 400;
    throw error;
  }

  const result = await queryable.query(
    `
    SELECT
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
      last_period,
      created_at,
      updated_at,
      TO_CHAR(CURRENT_DATE, 'YYYY') AS current_year,
      TO_CHAR(CURRENT_DATE, 'MM') AS current_month
    FROM app.code_number_settings
    WHERE module_key = $1
    `,
    [normalizedModuleKey],
  );

  if (result.rows.length === 0) {
    const error = new Error(
      `Numbering setting not found for ${normalizedModuleKey}`,
    );
    error.statusCode = 500;
    throw error;
  }

  return result.rows[0];
};

const buildSettingResponse = (setting) => {
  const periodKey = getPeriodKey(setting);
  const nextNumber =
    setting.last_period === periodKey
      ? Number(setting.last_number) + 1
      : 1;

  return {
    module_key: setting.module_key,
    module_label: setting.module_label,
    field_name: setting.field_name,
    is_automatic: setting.is_automatic,
    prefix: setting.prefix,
    separator: setting.separator,
    digit_length: Number(setting.digit_length),
    include_year: setting.include_year,
    include_month: setting.include_month,
    reset_rule: setting.reset_rule,
    last_number: Number(setting.last_number),
    next_number: nextNumber,
    preview: formatCode(setting, nextNumber),
    created_at: setting.created_at,
    updated_at: setting.updated_at,
  };
};

const resolveCodeNumber = async ({
  client,
  moduleKey,
  manualCode,
}) => {
  const normalizedModuleKey = normalizeModuleKey(moduleKey);
  const definition = MODULE_DEFINITIONS[normalizedModuleKey];
  const initialSetting = await getSetting(
    client,
    normalizedModuleKey,
  );

  if (!initialSetting.is_automatic) {
    const normalizedCode = normalizeManualCode(manualCode);

    if (!normalizedCode) {
      const error = new Error(
        `${initialSetting.field_name} is required while automatic numbering is disabled`,
      );
      error.statusCode = 400;
      throw error;
    }

    if (normalizedCode.length > definition.maxLength) {
      const error = new Error(
        `${initialSetting.field_name} cannot exceed ${definition.maxLength} characters`,
      );
      error.statusCode = 400;
      throw error;
    }

    return normalizedCode;
  }

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const currentPeriod = getPeriodKey(initialSetting);
    const result = await client.query(
      `
      UPDATE app.code_number_settings
      SET
        last_number = CASE
          WHEN last_period = $2 THEN last_number + 1
          ELSE 1
        END,
        last_period = $2
      WHERE module_key = $1
        AND is_automatic = true
      RETURNING
        *,
        TO_CHAR(CURRENT_DATE, 'YYYY') AS current_year,
        TO_CHAR(CURRENT_DATE, 'MM') AS current_month
      `,
      [normalizedModuleKey, currentPeriod],
    );

    if (result.rows.length === 0) {
      const error = new Error(
        `Automatic numbering changed while creating ${normalizedModuleKey}`,
      );
      error.statusCode = 409;
      throw error;
    }

    const setting = result.rows[0];
    const generatedCode = formatCode(
      setting,
      Number(setting.last_number),
    );

    if (generatedCode.length > definition.maxLength) {
      const error = new Error(
        `Generated ${setting.field_name} exceeds ${definition.maxLength} characters`,
      );
      error.statusCode = 400;
      throw error;
    }

    const duplicateResult = await client.query(
      `
      SELECT 1
      FROM app.${definition.table}
      WHERE UPPER(${definition.column}) = UPPER($1)
      LIMIT 1
      `,
      [generatedCode],
    );

    if (duplicateResult.rows.length === 0) {
      return generatedCode;
    }
  }

  const error = new Error(
    `Unable to generate a unique code for ${normalizedModuleKey}`,
  );
  error.statusCode = 409;
  throw error;
};

module.exports = {
  MODULE_DEFINITIONS,
  buildSettingResponse,
  formatCode,
  getSetting,
  normalizeModuleKey,
  resolveCodeNumber,
};
