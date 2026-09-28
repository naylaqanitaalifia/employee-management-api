const pool = require("../config/db");
const Joi = require("joi");
const { v4: uuidv4 } = require("uuid");
const { required } = require("../utils/validation");

const getAllSchedules = async (req, res) => {
  try {
    const { id, role } = req.user;

    const schema = Joi.object({
      filter: Joi.string().allow("").optional(),
      limit: Joi.number().min(1).required(),
      page: Joi.number().min(1).required(),
      with_deleted: Joi.boolean().required(),
      order_field: Joi.string().min(1).required(),
      order_direction: Joi.string().valid("ASC", "DESC").required(),
    });

    // Memvalidasi query parameter menggunakan schema di atas.
    const param = await schema.validateAsync(req.query);

    // Mengubah filter menjadi object jika filter dikirim dalam format JSON.
    let parsedFilter = {};

    // Memeriksa apakah filter dikirim dan tidak kosong.
    if (param.filter) {
      try {
        parsedFilter = JSON.parse(param.filter);
      } catch (error) {
        return res.status(400).json({
          status: false,
          code: 400,
          message: "Invalid filter format",
        });
      }
    }

    const allowedFilterFields = ["name"];

    // Mengambil semua nama field yang dikirim di dalam filter.
    const filterFields = Object.keys(parsedFilter);

    // Memastikan semua field yang dikirim merupakan field yang diperbolehkan.
    const hasInvalidFilter = filterFields.some(
      (field) => !allowedFilterFields.includes(field),
    );

    if (hasInvalidFilter) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Invalid filter field",
      });
    }

    // Mengambil nilai name dari filter.
    const filterName = parsedFilter.name || "";

    const limit = param.limit;

    // Menghitung offset berdasarkan page dan limit.
    const offset = (param.page - 1) * limit;

    // Daftar kolom yang boleh digunakan untuk sorting.

    const allowedOrderFields = {
      id: "p.id",
      name: "e.name",
      period_month: "p.period_month",
      created_at: "p.created_at",
      created_by: "p.created_by",
      updated_at: "p.updated_at",
      updated_by: "p.updated_by",
      deleted_at: "p.deleted_at",
      deleted_by: "p.deleted_by",
    };

    // Memastikan field sorting valid.
    if (!allowedOrderFields[param.order_field]) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Invalid order field",
      });
    }

    const deletedCondition = param.with_deleted
      ? ""
      : "AND p.deleted_at IS NULL";

    if (role !== "ADMIN") {
      const [user] = await pool.query(
        "SELECT employee_id FROM users WHERE id = ?",
        [id],
      );

      if (user.length === 0) {
        return res.status(404).json({
          status: false,
          code: 404,
          message: "Employee not found",
        });
      }

      // whereClause += ` AND p.employee_id = ?`;
      // queryParams.push(user[0].employee_id);
    }

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
        ${deletedCondition}
        ORDER BY ${allowedOrderFields[param.order_field]} ${param.order_direction}
        LIMIT ${limit}
        OFFSET ${offset}
    `,
      [`%${filterName}%`],
    );

    const [[{ total }]] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM payrolls p
        INNER JOIN employees e
          ON p.employee_id = e.id
        WHERE e.name LIKE ?
        ${deletedCondition}
      `,
      [`%${filterName}%`],
    );

    res.status(200).json({
      status: true,
      code: 200,
      message: "Payroll fetched successfully",
      data: {
        count: rows.length,
        page: param.page,
        total_count: total,
        list: rows.map((row) => ({
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

const getScheduleById = async (req, res) => {
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

const createSchedule = async (req, res) => {
  try {
    const id = uuidv4();
    const created_by = req.user.id;

    const {
      title,
      type,
      description,
      start_date,
      end_date,
      start_time,
      end_time,
      location_type,
      location,
      online_meeting_link,
      employee_ids,
    } = req.body;

    const errors = required({
      title,
      type,
      start_date,
      end_date,
      start_time,
      end_time,
      location_type,
    });

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Validation Error",
        errors,
      });
    }

    if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Employee ids must be a non-empty array",
      });
    }

    if (!["online", "offline", "hybrid"].includes(location_type)) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Invalid location type",
      });
    }

    if (location_type === "online" && !online_meeting_link) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Online meeting link is required for online location type",
      });
    }

    if (location_type === "offline" && !location) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Location is required for offline location type",
      });
    }

    if (location_type === "hybrid" && (!location || !online_meeting_link)) {
      return res.status(400).json({
        status: false,
        code: 400,
        message:
          "Location and online meeting link is required for hybrid location type",
      });
    }

    const [employees] = await pool.query(
      "SELECT id, name FROM employees WHERE id IN (?)",
      [employee_ids],
    );

    if (employees.length !== employee_ids.length) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "One or more employees not found",
      });
    }

    await pool.query(
      `
        INSERT INTO schedules (
          id,
          title,
          type,
          description,
          start_date,
          end_date,
          start_time,
          end_time,
          location_type,
          location,
          online_meeting_link,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        title,
        type,
        description,
        start_date,
        end_date,
        start_time,
        end_time,
        location_type,
        location,
        online_meeting_link,
        created_by,
      ],
    );

    const scheduleEmployee = employee_ids.map((employee_id) => [
      uuidv4(),
      id,
      employee_id,
      created_by,
    ]);

    await pool.query(
      `
        INSERT INTO schedule_employees (
          id,
          schedule_id, 
          employee_id,
          created_by
        )
        VALUES ?
      `,
      [scheduleEmployee],
    );

    res.status(201).json({
      status: true,
      code: 201,
      message: "Schedule created successfully",
      data: {
        id,
        title,
        type,
        description,
        start_date,
        end_date,
        start_time,
        end_time,
        location_type,
        location,
        online_meeting_link,
        employee_ids: employees.map((employee) => ({
          id: employee.id,
          name: employee.name,
        })),
        created_by,
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

const updateSchedule = async (req, res) => {
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

const deleteSchedule = async (req, res) => {
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

module.exports = {
  getAllSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
};
