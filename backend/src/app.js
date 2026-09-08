require("dotenv").config();

const authorizeRoles = require(
  "./middleware/authorizeRoles"
);

const express = require("express");
const pool = require("./config/database");
const supplierRoutes = require("./routes/supplierRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const purchaseOrderRoutes = require("./routes/purchaseOrderRoutes");
const goodsReceiptRoutes = require("./routes/goodsReceiptRoutes");
const inventoryMovementRoutes = require("./routes/inventoryMovementRoutes");
const customerRoutes = require("./routes/customerRoutes");
const salesOrderRoutes = require("./routes/salesOrderRoutes");
const deliveryRoutes = require("./routes/deliveryRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const reportRoutes = require("./routes/reportRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const codeNumberSettingRoutes = require(
  "./routes/codeNumberSettingRoutes"
);
const paymentSettingRoutes = require(
  "./routes/paymentSettingRoutes"
);
const supplierInvoiceRoutes = require("./routes/supplierInvoiceRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const masterDataImportRoutes = require(
  "./routes/masterDataImportRoutes"
);
const auditMiddleware = require("./middleware/auditMiddleware");

const authenticate = require("./middleware/authMiddleware");

const app = express();

// const PORT = Number(process.env.PORT) || 3000;

// Wajib agar Express bisa membaca JSON body
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    message: "Supplier Management API is running",
  });
});

app.get(
  "/api/test-db",
  authenticate,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT NOW()"
      );

      res.json({
        success: true,
        message:
          "Database connected successfully",
        database_time: result.rows[0].now,
      });
    } catch (error) {
      console.error(
        "Database connection error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Database connection failed",
      });
    }
  }
);

app.use("/api", auditMiddleware);

app.use("/api/dashboard", authenticate, dashboardRoutes);
app.use("/api/reports", authenticate, reportRoutes);
app.use("/api/suppliers", authenticate, supplierRoutes);
app.use("/api/categories", authenticate, categoryRoutes);
app.use("/api/products", authenticate, productRoutes);
app.use("/api/purchase-orders", authenticate, purchaseOrderRoutes);
app.use("/api/goods-receipts", authenticate, goodsReceiptRoutes);
app.use("/api/inventory-movements", authenticate, inventoryMovementRoutes);
app.use("/api/customers", authenticate, customerRoutes);
app.use("/api/sales-orders", authenticate, salesOrderRoutes);
app.use("/api/deliveries", authenticate, deliveryRoutes);
app.use("/api/invoices", authenticate, invoiceRoutes);
app.use("/api/payments", authenticate, paymentRoutes);
app.use("/api/supplier-invoices", authenticate, supplierInvoiceRoutes);
app.use("/api/notifications", authenticate, notificationRoutes);
app.use("/api/audit-logs", authenticate, auditLogRoutes);
app.use(
  "/api/master-data-import",
  authenticate,
  masterDataImportRoutes
);
app.use("/api/users", authenticate, userRoutes);
app.use(
  "/api/code-number-settings",
  authenticate,
  codeNumberSettingRoutes
);
app.use(
  "/api/payment-settings",
  authenticate,
  paymentSettingRoutes
);
app.use("/api/auth", authRoutes);

app.use((error, req, res, next) => {
  if (error instanceof require("multer").MulterError) {
    return res.status(400).json({
      success: false,
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Ukuran file maksimal 2 MB"
          : "File impor tidak dapat diproses",
    });
  }

  if (error?.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  return next(error);
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

module.exports = app;

// app.listen(PORT, () => {
//   console.log(`Server running at http://localhost:${PORT}`);
// });
