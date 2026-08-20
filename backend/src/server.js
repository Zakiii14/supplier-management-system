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
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");

const authenticate = require("./middleware/authMiddleware");

const app = express();

const PORT = Number(process.env.PORT) || 3000;

// Wajib agar Express bisa membaca JSON body
app.use(express.json());

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
app.use("/api/users", authenticate, userRoutes);
app.use("/api/auth", authRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});