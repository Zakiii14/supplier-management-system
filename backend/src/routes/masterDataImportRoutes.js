const express = require("express");
const multer = require("multer");
const authorizeRoles = require("../middleware/authorizeRoles");
const {
  downloadImportTemplate,
  getImportModules,
  previewImport,
  saveImport,
} = require("../controllers/masterDataImportController");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    const validExtension = file.originalname.toLowerCase().endsWith(".xlsx");
    if (!validExtension) {
      const error = new Error("File harus menggunakan format .xlsx");
      error.statusCode = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

router.use(authorizeRoles("ADMIN"));
router.get("/modules", getImportModules);
router.get("/template/:module", downloadImportTemplate);
router.post("/preview", upload.single("file"), previewImport);
router.post("/commit", saveImport);

module.exports = router;
