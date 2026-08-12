const express = require("express");
const router = express.Router();

const {
  getAllPayrolls,
  getPayrollById,
  createPayroll,
  updatePayroll,
  deletePayroll,
  statusPayroll
} = require("../controllers/payroll.controller");

router.get("/", getAllPayrolls);
router.get("/:id", getPayrollById);
router.post("/", createPayroll);
router.put("/:id", updatePayroll);
router.delete("/:id", deletePayroll);
router.patch("/:id/status", statusPayroll);

module.exports = router;
