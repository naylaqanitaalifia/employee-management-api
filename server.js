require("dotenv").config();

const express = require("express");
const cors = require("cors");

const pool = require("./src/config/db");
const departmentRoutes = require("./src/routes/department.route");
const positionRoutes = require("./src/routes/position.route");
const employeeRoutes = require("./src/routes/employee.route");

const app = express();

app.use(cors());
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
