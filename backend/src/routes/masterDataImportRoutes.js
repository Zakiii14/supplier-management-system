const express = require("express");
const multer = require("multer");
const authorizeRoles = require("../middleware/authorizeRoles");
const {
  blockDemoMutation,
} = require("../middleware/demoModeMiddleware");
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
router.post(
  "/preview",
  blockDemoMutation,
  upload.single("file"),
  previewImport,
);
router.post(
  "/commit",
  blockDemoMutation,
  saveImport,
);

module.exports = router;
