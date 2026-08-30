const pool = require("../config/database");

const getSupplierReportOptions = async (
  req,
  res,
) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        supplier_code,
        supplier_name
      FROM app.suppliers
      WHERE status = 'ACTIVE'
      ORDER BY supplier_name ASC
    `);

    res.status(200).json({
      success: true,
      message:
        "Supplier report options retrieved successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error(
      "Error fetching supplier report options:",
      error,
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve supplier report options",
    });
  }
};

const getCategoryReportOptions = async (
  req,
  res,
) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        category_code,
        category_name
      FROM app.categories
      WHERE status = 'ACTIVE'
      ORDER BY category_name ASC
    `);

    res.status(200).json({
      success: true,
      message:
        "Category report options retrieved successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error(
      "Error fetching category report options:",
      error,
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve category report options",
    });
  }
};

const getCustomerReportOptions = async (
  req,
  res,
) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        customer_code,
        customer_name
      FROM app.customers
      WHERE status = 'ACTIVE'
      ORDER BY customer_name ASC
    `);

    res.status(200).json({
      success: true,
      message:
        "Customer report options retrieved successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error(
      "Error fetching customer report options:",
      error,
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to retrieve customer report options",
    });
  }
};

module.exports = {
  getCategoryReportOptions,
  getCustomerReportOptions,
  getSupplierReportOptions,
};