const express = require("express"); // Mengimport Express untuk membuat aplikasi backend.
const cors = require("cors");

const swaggerUi = require("swagger-ui-express"); // Mengimport Swagger UI untuk menampilkan dokumentasi API di browser.
const swaggerSpec = require("./config/swagger"); // Mengambil konfigurasi OpenAPI yang sudah dibuat di swagger.js.

const pool = require("./config/db");

const authRoutes = require("./routes/auth.route");
const departmentRoutes = require("./routes/department.route");
const positionRoutes = require("./routes/position.route");
const employeeRoutes = require("./routes/employee.route");
const leaveRoutes = require("./routes/leave.route");
const payrollRoutes = require("./routes/payroll.route");
const authMiddleware = require("./middleware/auth-middleware");

const app = express(); // Membuat instance aplikasi Express.

app.use(cors());
app.use(express.json()); // Membuat Express bisa membaca request body dalam format JSON.

app.use(
  "/api-docs", // Menentukan URL untuk membuka dokumentasi Swagger.
  swaggerUi.serve, // Menyediakan file-file yang dibutuhkan Swagger UI.
  swaggerUi.setup(swaggerSpec), // // Menghubungkan Swagger UI dengan dokumentasi OpenAPI yang sudah dibuat.
);

app.use("/api/auth", authRoutes);
// app.use(authMiddleware);
app.use("/api/departments", departmentRoutes);
app.use("/api/positions", positionRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/payrolls", payrollRoutes);

app.get("/", async (req, res) => {
  const [rows] = await pool.query("SELECT 1");

  res.json({
    message: "API Running",
    db: rows,
  });
});

module.exports = app;
