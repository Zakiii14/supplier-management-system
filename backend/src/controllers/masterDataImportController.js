const pool = require("../config/database");
const {
  buildTemplateWorkbook,
  commitImport,
  getDefinition,
  listModules,
  parseImportRows,
  validateRows,
} = require("../services/masterDataImportService");

const getImportModules = (req, res) => {
  res.status(200).json({
    success: true,
    data: listModules(),
  });
};

const downloadImportTemplate = (req, res) => {
  try {
    const workbook = buildTemplateWorkbook(req.params.module);
    res.setHeader("Content-Type", workbook.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${workbook.fileName}"`,
    );
    res.setHeader("Content-Length", workbook.buffer.length);
    res.status(200).send(workbook.buffer);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Template impor gagal dibuat",
    });
  }
};

const previewImport = async (req, res) => {
  try {
    const definition = getDefinition(req.body.module);
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "File Excel wajib dipilih",
      });
    }
    if (
      req.file.buffer.length < 4 ||
      req.file.buffer[0] !== 0x50 ||
      req.file.buffer[1] !== 0x4b
    ) {
      return res.status(400).json({
        success: false,
        message: "File harus berupa workbook Excel (.xlsx)",
      });
    }
    const rows = parseImportRows(req.file.buffer, definition.key);
    const result = await validateRows(pool, definition.key, rows);
    res.status(200).json({
      success: true,
      message: "Pratinjau impor berhasil dibuat",
      data: result,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "File impor gagal diperiksa",
    });
  }
};

const saveImport = async (req, res) => {
  try {
    const result = await commitImport(
      pool,
      req.body.module,
      req.body.rows,
    );
    res.status(201).json({
      success: true,
      message: `${result.imported} data berhasil diimpor`,
      data: result,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Data gagal diimpor",
      ...(error.details ? { details: error.details } : {}),
    });
  }
};

module.exports = {
  downloadImportTemplate,
  getImportModules,
  previewImport,
  saveImport,
};
