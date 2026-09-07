const pool = require("../config/database");

const PURCHASE_SCHEMES = [
  "DIRECT",
  "TERM",
  "DOWN_PAYMENT",
  "COD",
];

const getPaymentSettings = async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        default_purchase_scheme,
        default_purchase_term_days,
        default_down_payment_percent,
        require_purchase_transfer_proof,
        require_sales_transfer_proof,
        updated_by,
        created_at,
        updated_at
      FROM app.payment_settings
      WHERE id = 1
      `,
    );

    res.status(200).json({
      success: true,
      message: "Payment settings retrieved successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching payment settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve payment settings",
    });
  }
};

const updatePaymentSettings = async (req, res) => {
  try {
    const scheme =
      typeof req.body.default_purchase_scheme === "string"
        ? req.body.default_purchase_scheme.trim().toUpperCase()
        : "";
    const termDays = Number(req.body.default_purchase_term_days);
    const downPaymentPercent = Number(
      req.body.default_down_payment_percent,
    );
    const requirePurchaseProof =
      req.body.require_purchase_transfer_proof;
    const requireSalesProof = req.body.require_sales_transfer_proof;

    if (!PURCHASE_SCHEMES.includes(scheme)) {
      return res.status(400).json({
        success: false,
        message: "Invalid default purchase payment scheme",
      });
    }

    if (
      !Number.isInteger(termDays) ||
      termDays < 0 ||
      termDays > 365
    ) {
      return res.status(400).json({
        success: false,
        message: "Default payment term must be 0-365 days",
      });
    }

    if (
      !Number.isFinite(downPaymentPercent) ||
      downPaymentPercent < 0 ||
      downPaymentPercent > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Default down payment must be 0-100 percent",
      });
    }

    if (
      typeof requirePurchaseProof !== "boolean" ||
      typeof requireSalesProof !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "Proof requirements must be boolean values",
      });
    }

    const result = await pool.query(
      `
      UPDATE app.payment_settings
      SET
        default_purchase_scheme = $1,
        default_purchase_term_days = $2,
        default_down_payment_percent = $3,
        require_purchase_transfer_proof = $4,
        require_sales_transfer_proof = $5,
        updated_by = $6
      WHERE id = 1
      RETURNING *
      `,
      [
        scheme,
        termDays,
        downPaymentPercent,
        requirePurchaseProof,
        requireSalesProof,
        req.user.id,
      ],
    );

    res.status(200).json({
      success: true,
      message: "Payment settings updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating payment settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update payment settings",
    });
  }
};

module.exports = {
  getPaymentSettings,
  updatePaymentSettings,
};
