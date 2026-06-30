require("dotenv").config();

const express = require("express");
const pool = require("./config/db");
const departmentRoutes = require("./routes/department.route");
const positionRoutes = require("./routes/position.route");
const employeeRoutes = require("./routes/employee.route");

const app = express();

app.use(express.json());

app.use("/api/departments", departmentRoutes);
app.use("/api/positions", positionRoutes);
app.use("/api/employees", employeeRoutes);

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
