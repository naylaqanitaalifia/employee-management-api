require("dotenv").config();

const express = require("express");
const cors = require("cors");

const pool = require("./config/db");
const authRoutes = require("./routes/auth.route");
const departmentRoutes = require("./routes/department.route");
const positionRoutes = require("./routes/position.route");
const employeeRoutes = require("./routes/employee.route");
const leaveRoutes = require("./routes/leave.route");
const payrollRoutes = require("./routes/payroll.route");
const authMiddleware = require("./middleware/auth-middleware");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use(authMiddleware);
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
