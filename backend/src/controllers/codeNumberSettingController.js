const pool = require("../config/database");
const {
  MODULE_DEFINITIONS,
  buildSettingResponse,
  getSetting,
  normalizeModuleKey,
} = require("../services/codeNumberService");

const RESET_RULES = ["NEVER", "YEARLY", "MONTHLY"];
const SEPARATORS = ["", "-", "/", "."];

const getAllCodeNumberSettings = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        *,
        TO_CHAR(CURRENT_DATE, 'YYYY') AS current_year,
        TO_CHAR(CURRENT_DATE, 'MM') AS current_month
      FROM app.code_number_settings
      ORDER BY module_label ASC
      `,
    );

    res.status(200).json({
      success: true,
      message: "Code numbering settings retrieved successfully",
      data: result.rows.map(buildSettingResponse),
    });
  } catch (error) {
    console.error("Error fetching code numbering settings:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve code numbering settings",
    });
  }
};

const getCodeNumberSetting = async (req, res) => {
  try {
    const setting = await getSetting(
      pool,
      req.params.moduleKey,
    );

    res.status(200).json({
      success: true,
      message: "Code numbering setting retrieved successfully",
      data: buildSettingResponse(setting),
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message ||
        "Failed to retrieve code numbering setting",
    });
  }
};

const updateCodeNumberSetting = async (req, res) => {
  try {
    const moduleKey = normalizeModuleKey(
      req.params.moduleKey,
    );

    if (!MODULE_DEFINITIONS[moduleKey]) {
      return res.status(400).json({
        success: false,
        message: "Invalid numbering module",
      });
    }

    const {
      is_automatic,
      prefix,
      separator,
      digit_length,
      include_year,
      include_month,
      reset_rule,
      next_number,
    } = req.body;

    const normalizedPrefix =
      typeof prefix === "string"
        ? prefix.trim().toUpperCase()
        : "";
    const normalizedSeparator =
      typeof separator === "string"
        ? separator
        : "";
    const normalizedResetRule =
      typeof reset_rule === "string"
        ? reset_rule.trim().toUpperCase()
        : "";
    const digitLength = Number(digit_length);
    const nextNumber = Number(next_number);

    if (typeof is_automatic !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "is_automatic must be a boolean",
      });
    }

    if (!/^[A-Z0-9]{1,12}$/.test(normalizedPrefix)) {
      return res.status(400).json({
        success: false,
        message:
          "Prefix must contain 1-12 uppercase letters or numbers",
      });
    }

    if (!SEPARATORS.includes(normalizedSeparator)) {
      return res.status(400).json({
        success: false,
        message: "Separator must be empty, -, /, or .",
      });
    }

    if (
      !Number.isInteger(digitLength) ||
      digitLength < 1 ||
      digitLength > 10
    ) {
      return res.status(400).json({
        success: false,
        message: "digit_length must be an integer from 1 to 10",
      });
    }

    if (
      typeof include_year !== "boolean" ||
      typeof include_month !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "include_year and include_month must be booleans",
      });
    }

    if (include_month && !include_year) {
      return res.status(400).json({
        success: false,
        message: "Month token requires the year token",
      });
    }

    if (!RESET_RULES.includes(normalizedResetRule)) {
      return res.status(400).json({
        success: false,
        message: "reset_rule must be NEVER, YEARLY, or MONTHLY",
      });
    }

    if (
      (normalizedResetRule === "YEARLY" && !include_year) ||
      (
        normalizedResetRule === "MONTHLY" &&
        (!include_year || !include_month)
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Reset rule requires matching year and month tokens",
      });
    }

    if (
      !Number.isSafeInteger(nextNumber) ||
      nextNumber < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "next_number must be a positive integer",
      });
    }

    const result = await pool.query(
      `
      UPDATE app.code_number_settings
      SET
        is_automatic = $1,
        prefix = $2,
        separator = $3,
        digit_length = $4,
        include_year = $5,
        include_month = $6,
        reset_rule = $7::VARCHAR,
        last_number = $8,
        last_period = CASE
          WHEN $7::VARCHAR = 'MONTHLY'
            THEN TO_CHAR(CURRENT_DATE, 'YYYYMM')
          WHEN $7::VARCHAR = 'YEARLY'
            THEN TO_CHAR(CURRENT_DATE, 'YYYY')
          ELSE 'GLOBAL'
        END,
        updated_by = $9
      WHERE module_key = $10
      RETURNING
        *,
        TO_CHAR(CURRENT_DATE, 'YYYY') AS current_year,
        TO_CHAR(CURRENT_DATE, 'MM') AS current_month
      `,
      [
        is_automatic,
        normalizedPrefix,
        normalizedSeparator,
        digitLength,
        include_year,
        include_month,
        normalizedResetRule,
        nextNumber - 1,
        req.user.id,
        moduleKey,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Code numbering setting not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Code numbering setting updated successfully",
      data: buildSettingResponse(result.rows[0]),
    });
  } catch (error) {
    console.error("Error updating code numbering setting:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update code numbering setting",
    });
  }
};

module.exports = {
  getAllCodeNumberSettings,
  getCodeNumberSetting,
  updateCodeNumberSetting,
};
