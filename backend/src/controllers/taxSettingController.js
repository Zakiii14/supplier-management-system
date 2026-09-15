const pool = require("../config/database");

const getTaxSettings = async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id,is_enabled,tax_name,default_rate,allow_invoice_override,
              updated_by,created_at,updated_at
       FROM app.tax_settings WHERE id=1`,
    );
    return res.status(200).json({ success: true, message: "Tax settings retrieved successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Error fetching tax settings:", error);
    return res.status(500).json({ success: false, message: "Pengaturan pajak gagal dimuat" });
  }
};

const updateTaxSettings = async (req, res) => {
  try {
    const isEnabled = req.body.is_enabled;
    const taxName = typeof req.body.tax_name === "string" ? req.body.tax_name.trim().slice(0, 40) : "";
    const defaultRate = Number(req.body.default_rate);
    const allowOverride = req.body.allow_invoice_override;

    if (typeof isEnabled !== "boolean" || typeof allowOverride !== "boolean") {
      return res.status(400).json({ success: false, message: "Status pajak dan izin koreksi harus berupa boolean" });
    }
    if (!taxName) {
      return res.status(400).json({ success: false, message: "Nama pajak wajib diisi" });
    }
    if (!Number.isFinite(defaultRate) || defaultRate < 0 || defaultRate > 100) {
      return res.status(400).json({ success: false, message: "Persentase pajak harus berada antara 0 sampai 100" });
    }

    const result = await pool.query(
      `UPDATE app.tax_settings
       SET is_enabled=$1,tax_name=$2,default_rate=$3,allow_invoice_override=$4,updated_by=$5
       WHERE id=1 RETURNING *`,
      [isEnabled,taxName,defaultRate,allowOverride,req.user.id],
    );
    return res.status(200).json({ success: true, message: "Tax settings updated successfully", data: result.rows[0] });
  } catch (error) {
    console.error("Error updating tax settings:", error);
    return res.status(500).json({ success: false, message: "Pengaturan pajak gagal disimpan" });
  }
};

module.exports = { getTaxSettings, updateTaxSettings };
