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
            p.created_at,
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
      "SELECT COUNT(*) as total FROM leaves",
    );

    res.status(200).json({
      status: true,
      code: 200,
      message: "Payroll data fetched successfully",
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
        created_at: row.created_at,
        created_by: row.created_by,
        updated_at: row.updated_at,
        updated_by: row.updated_by,
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

const getLeaveById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `
        SELECT p.*,
            e.id AS employee_id, 
            e.name AS employee_name,
            p.id AS employee_position_id,
            p.name AS employee_position_name
        FROM leaves l
        INNER JOIN employees e
            ON l.employee_id = e.id
        INNER JOIN positions p 
            ON e.position_id = p.id
        WHERE l.id = ?
    `,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Data not found",
      });
    }

    res.status(200).json({
      status: true,
      code: 200,
      message: "Payroll data fetched successfully",
      data: {
        id: rows[0].id,
        employee: {
          id: rows[0].employee_id,
          name: rows[0].employee_name,
          position: {
            id: rows[0].employee_position_id,
            name: rows[0].employee_position_name,
          },
        },
        days: rows[0].days,
        start_date: rows[0].start_date,
        end_date: rows[0].end_date,
        created_at: rows[0].created_at,
        created_by: rows[0].created_by,
        approved_at: rows[0].approved_at,
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

    await pool.query(
      `INSERT INTO payrolls (id, employee_id, period_month, basic_salary, allowance, overtime_pay, deduction) VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        employee_id,
        period_month,
        basic_salary,
        allowance,
        overtime_pay,
        deduction,
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
    const { type, start_date, end_date, reason } = req.body;

    const [existing] = await pool.query(
      "SELECT id, status FROM leaves WHERE id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        message: "Leave not found",
      });
    }

    const errors = required({
      type,
      start_date,
      end_date,
      reason,
    });

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Validation Error",
        errors,
      });
    }

    if (existing[0].status !== "pending") {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Only pending leave can be updated",
      });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Invalid date format",
      });
    }

    if (endDate < startDate) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "End date must be greater than start date",
      });
    }

    const days =
      Math.floor(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;

    await pool.query(
      `UPDATE leaves
       SET type = ?,
           days = ?,
           start_date = ?,
           end_date = ?,
           reason = ?
       WHERE id = ?`,
      [type, days, start_date, end_date, reason, id],
    );

    res.status(200).json({
      status: true,
      code: 200,
      message: "Payroll updated successfully",
      data: {
        id,
        type,
        days,
        start_date,
        end_date,
        reason,
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

    const [result] = await pool.query("DELETE FROM leaves WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Leave not found",
      });
    }

    res.status(200).json({
      message: "Leave deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
