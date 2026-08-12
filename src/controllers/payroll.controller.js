const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const { required } = require("../utils/validation");

const getAllPayrolls = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.size) || 10;
    const search = req.query.search || "";

    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      `
        SELECT 
            p.id,
            p.period_month,
            p.basic_salary,
            p.allowance,
            p.overtime_pay,
            p.deduction,
            p.net_salary,
            p.status,
            p.created_at,
            p.updated_at,
            e.id AS employee_id, 
            e.name AS employee_name 
        FROM payrolls p
        INNER JOIN employees e 
            ON p.employee_id = e.id
        WHERE e.name LIKE ?
        ORDER BY p.created_at DESC
        LIMIT ? 
        OFFSET ?
    `,
      [`%${search}%`, limit, offset],
    );

    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) as total FROM payrolls",
    );

    res.status(200).json({
      status: true,
      code: 200,
      message: "Payroll fetched successfully",
      data: rows.map((row) => ({
        id: row.id,
        employee: {
          id: row.employee_id,
          name: row.employee_name,
        },
        period_month: row.period_month,
        basic_salary: row.basic_salary,
        allowance: row.allowance,
        overtime_pay: row.overtime_pay,
        deduction: row.deduction,
        net_salary: row.net_salary,
        status: row.status,
        created_at: row.created_at,
        // created_by: row.created_by,
        updated_at: row.updated_at,
        // updated_by: row.updated_by,
      })),
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      code: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getPayrollById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
        SELECT p.*,
            e.id AS employee_id, 
            e.name AS employee_name
        FROM payrolls p
        INNER JOIN employees e
            ON p.employee_id = e.id
        WHERE p.id = ?
    `,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Payroll not found",
      });
    }

    res.status(200).json({
      status: true,
      code: 200,
      message: "Payroll fetched successfully",
      data: {
        id: rows[0].id,
        employee: {
          id: rows[0].employee_id,
          name: rows[0].employee_name,
          // position: {
          //   id: rows[0].employee_position_id,
          //   name: rows[0].employee_position_name,
          // },
        },
        period_month: rows[0].period_month,
        basic_salary: rows[0].basic_salary,
        allowance: rows[0].allowance,
        overtime_pay: rows[0].overtime_pay,
        deduction: rows[0].deduction,
        net_salary: rows[0].net_salary,
        status: rows[0].status,
        paid_at: rows[0].paid_at,
        created_at: rows[0].created_at,
        created_by: rows[0].created_by,
        updated_at: rows[0].updated_at,
        updated_by: rows[0].updated_by,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      code: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const createPayroll = async (req, res) => {
  try {
    const id = uuidv4();
    const {
      employee_id,
      period_month,
      basic_salary,
      allowance,
      overtime_pay,
      deduction,
    } = req.body;

    const errors = required({
      employee_id,
      period_month,
      basic_salary,
      allowance,
      overtime_pay,
      deduction,
    });

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Validation Error",
        errors,
      });
    }

    const [employee] = await pool.query(
      "SELECT id, name FROM employees WHERE id = ?",
      [employee_id],
    );

    if (employee.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Employee not found",
      });
    }

    const net_salary =
      Number(basic_salary) +
      Number(allowance) +
      Number(overtime_pay) -
      Number(deduction);

    await pool.query(
      `
        INSERT INTO payrolls (
          id,
          employee_id,
          period_month,
          basic_salary,
          allowance,
          overtime_pay,
          deduction,
          net_salary
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        employee_id,
        period_month,
        basic_salary,
        allowance,
        overtime_pay,
        deduction,
        net_salary,
      ],
    );

    res.status(201).json({
      status: true,
      code: 201,
      message: "Payroll created successfully",
      data: {
        id,
        employee: {
          id: employee[0].id,
          name: employee[0].name,
        },
        period_month,
        basic_salary,
        allowance,
        overtime_pay,
        deduction,
        net_salary,
        status: "draft",
        paid_at: null,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      code: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const updatePayroll = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      employee_id,
      period_month,
      basic_salary,
      allowance,
      overtime_pay,
      deduction,
    } = req.body;

    const [existing] = await pool.query(
      "SELECT id, status FROM payrolls WHERE id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        message: "Payroll not found",
      });
    }

    const errors = required({
      employee_id,
      period_month,
      basic_salary,
      allowance,
      overtime_pay,
      deduction,
    });

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Validation Error",
        errors,
      });
    }

    if (existing[0].status !== "draft") {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Only draft payroll can be updated",
      });
    }

    const [employee] = await pool.query(
      "SELECT id, name FROM employees WHERE id = ?",
      [employee_id],
    );

    if (employee.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Employee not found",
      });
    }

    const net_salary =
      Number(basic_salary) +
      Number(allowance) +
      Number(overtime_pay) -
      Number(deduction);

    await pool.query(
      `UPDATE payrolls
       SET employee_id = ?,
           period_month = ?,
           basic_salary = ?,
           allowance = ?,
           overtime_pay = ?,
           deduction = ?,
           net_salary = ?
       WHERE id = ?`,
      [
        employee_id,
        period_month,
        basic_salary,
        allowance,
        overtime_pay,
        deduction,
        net_salary,
        id,
      ],
    );

    res.status(200).json({
      status: true,
      code: 200,
      message: "Payroll updated successfully",
      data: {
        id,
        employee_id,
        period_month,
        basic_salary,
        allowance,
        overtime_pay,
        deduction,
        net_salary,
        status: existing[0].status,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      code: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const deletePayroll = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      "SELECT id, status FROM payrolls WHERE id = ?",
      [id],
    );

    if (result.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Payroll not found",
      });
    }

    if (result[0].status !== "draft") {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Payroll cannot be deleted",
      });
    }

    await pool.query("DELETE FROM payrolls WHERE id = ?", [id]);

    res.status(200).json({
      status: true,
      code: 200,
      message: "Payroll deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      code: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const statusPayroll = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      "SELECT id, status FROM payrolls WHERE id = ?",
      [id],
    );

    if (result.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Payroll not found",
      });
    }

    if (result[0].status === "cancel") {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Payroll has already been cancelled",
      });
    }

    if (result[0].status === "paid") {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Payroll has already been paid",
      });
    }

    const nextStatus = result[0].status === "draft" ? "processed" : "paid";

    const paidAt = nextStatus === "paid" ? new Date() : null;

    await pool.query(
      "UPDATE payrolls SET status = ?, paid_at = ? WHERE id = ?",
      [nextStatus, paidAt, id],
    );

    res.status(200).json({
      status: true,
      code: 200,
      message: "Payroll status updated successfully",
      data: {
        id,
        status: nextStatus,
        paid_at: paidAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      code: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports = {
  getAllPayrolls,
  getPayrollById,
  createPayroll,
  updatePayroll,
  deletePayroll,
  statusPayroll,
};
