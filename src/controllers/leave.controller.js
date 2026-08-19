const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const { required } = require("../utils/validation");

const getAllLeaves = async (req, res) => {
  try {
    const { id, role } = req.user;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.size) || 10;
    const search = req.query.search || "";

    const offset = (page - 1) * limit;

    let whereClause = `WHERE e.name LIKE ?`;
    const queryParams = [`%${search}%`];

    if (role !== "ADMIN") {
      whereClause += ` AND l.employee_id = ?`;
      queryParams.push(id);
    }

    const [rows] = await pool.query(
      `
        SELECT 
          l.id,
          l.type,
          l.days,
          l.start_date,
          l.end_date,
          l.status, 
          l.created_at,
          e.id AS employee_id, 
          e.name AS employee_name 
        FROM leaves l 
        INNER JOIN employees e 
          ON l.employee_id = e.id
        ${whereClause}
        ORDER BY l.created_at DESC
        LIMIT ? 
        OFFSET ?
    `,
      [...queryParams, limit, offset],
    );

    const [[{ total }]] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM leaves l
        INNER JOIN employees e
          ON l.employee_id = e.id
        ${whereClause}
      `,
      queryParams,
    );

    res.status(200).json({
      status: true,
      code: 200,
      message: "Data has been successfully fetched",
      data: rows.map((row) => ({
        id: row.id,
        type: row.type,
        days: row.days,
        start_date: row.start_date,
        end_date: row.end_date,
        status: row.status,
        created_at: row.created_at,
        employee: {
          id: row.employee_id,
          name: row.employee_name,
        },
      })),
      pagination: {
        page,
        size: limit,
        total,
        totalPages: Math.ceil(total / limit),
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

const getLeaveById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `
        SELECT l.*,
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
      message: "Leave data fetched successfully",
      data: {
        id: rows[0].id,
        type: rows[0].type,
        days: rows[0].days,
        start_date: rows[0].start_date,
        end_date: rows[0].end_date,
        reason: rows[0].reason,
        rejection_reason: rows[0].rejection_reason,
        status: rows[0].status,
        created_at: rows[0].created_at,
        approved_by: rows[0].approved_by,
        approved_at: rows[0].approved_at,
        employee: {
          id: rows[0].employee_id,
          name: rows[0].employee_name,
          position: {
            id: rows[0].employee_position_id,
            name: rows[0].employee_position_name,
          },
        },
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

const createLeave = async (req, res) => {
  try {
    const id = uuidv4();
    const { type, start_date, end_date, reason, employee_id } = req.body;

    const errors = required({
      type,
      start_date,
      end_date,
      reason,
      employee_id,
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
      `INSERT INTO leaves (id, type, days, start_date, end_date, reason, employee_id) VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [id, type, days, start_date, end_date, reason, employee_id],
    );

    res.status(201).json({
      status: true,
      code: 201,
      message: "Leave request created successfully",
      data: {
        id,
        type,
        days,
        start_date,
        end_date,
        reason,
        status: "pending",
        employee: {
          id: employee[0].id,
          name: employee[0].name,
        },
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

const updateLeave = async (req, res) => {
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
      message: "Leave request updated successfully",
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

const deleteLeave = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query("DELETE FROM leaves WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Leave not found",
      });
    }

    res.status(200).json({
      status: true,
      code: 200,
      message: "Leave deleted successfully",
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

const rejectLeave = async (req, res) => {
  const { id } = req.params;
  const { rejection_reason } = req.body;

  try {
    if (!rejection_reason || !rejection_reason.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Reject reason is required",
      });
    }

    const [rows] = await pool.query(
      "SELECT id, status FROM leaves WHERE id = ?",
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Data not found",
      });
    }

    if (rows[0].status !== "pending") {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Only pending leave can be rejected",
      });
    }

    await pool.query(
      // "UPDATE leaves SET rejection_reason = ?, status = ?, approved_by = ?, approved_at = ? WHERE id = ?",
      "UPDATE leaves SET rejection_reason = ?, status = ?, approved_at = ? WHERE id = ?",
      // [rejection_reason, "rejected", req.user.id, new Date(), id],
      [rejection_reason, "rejected", new Date(), id],
    );

    return res.status(200).json({
      status: true,
      code: 200,
      message: "Leave request rejected successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      code: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const approveLeave = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT id, status FROM leaves WHERE id = ?",
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Data not found",
      });
    }

    if (rows[0].status !== "pending") {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Only pending leave can be approved",
      });
    }

    await pool.query(
      // "UPDATE leaves SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?",
      // ["approved", req.user.id, new Date(), id],
      "UPDATE leaves SET status = ?, approved_at = ? WHERE id = ?",
      ["approved", new Date(), id],
    );

    return res.status(200).json({
      status: true,
      code: 200,
      message: "Leave request approved successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      code: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports = {
  getAllLeaves,
  getLeaveById,
  createLeave,
  updateLeave,
  deleteLeave,
  rejectLeave,
  approveLeave,
};
