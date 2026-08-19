const express = require("express");
const pool = require("./config/database");
const supplierRoutes = require("./routes/supplierRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");

const app = express();

const PORT = 3000;

// Wajib agar Express bisa membaca JSON body
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Supplier Management API is running",
  });
});

app.get("/api/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      success: true,
      message: "Database connected successfully",
      database_time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database connection error:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

app.use("/api/suppliers", supplierRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});