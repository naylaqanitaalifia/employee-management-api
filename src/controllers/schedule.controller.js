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

    const allowedFilterFields = ["title"];

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

    // Mengambil nilai title dari filter.
    const filterTitle = parsedFilter.title || "";

    const limit = param.limit;

    // Menghitung offset berdasarkan page dan limit.
    const offset = (param.page - 1) * limit;

    // Daftar kolom yang boleh digunakan untuk sorting.

    const allowedOrderFields = {
      id: "s.id",
      title: "s.title",
      created_at: "s.created_at",
      created_by: "s.created_by",
      updated_at: "s.updated_at",
      updated_by: "s.updated_by",
      deleted_at: "s.deleted_at",
      deleted_by: "s.deleted_by",
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
      : "AND s.deleted_at IS NULL";

    let employeeCondition = "";

    const queryParams = [`%${filterTitle}%`];

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

      employeeCondition = `
        AND EXISTS (
          SELECT 1
          FROM schedule_employees se
          WHERE se.schedule_id = s.id
            AND se.employee_id = ?
            AND se.deleted_at IS NULL
        )
      `;

      queryParams.push(user[0].employee_id);
    }

    const [rows] = await pool.query(
      `
        SELECT 
            s.id,
            s.title,
            s.type,
            s.start_date,
            s.end_date,
            s.start_time,
            s.end_time,
            s.created_at,
            s.created_by,
            s.updated_at,
            s.updated_by
        FROM schedules s
        WHERE s.title LIKE ?
        ${deletedCondition}
        ${employeeCondition}
        ORDER BY ${allowedOrderFields[param.order_field]} ${param.order_direction}
        LIMIT ${limit}
        OFFSET ${offset}
    `,
      queryParams,
    );

    const [[{ total }]] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM schedules s
        WHERE s.title LIKE ?
        ${deletedCondition}
        ${employeeCondition}
      `,
      queryParams,
    );

    res.status(200).json({
      status: true,
      code: 200,
      message: "Schedule fetched successfully",
      data: {
        count: rows.length,
        page: param.page,
        total_count: total,
        list: rows.map((row) => ({
          id: row.id,
          title: row.title,
          type: row.type,
          start_date: row.start_date,
          end_date: row.end_date,
          start_time: row.start_time,
          end_time: row.end_time,
          created_at: row.created_at,
          created_by: row.created_by,
          updated_at: row.updated_at,
          updated_by: row.updated_by,
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
        SELECT s.*,
            e.id AS employee_id, 
            e.name AS employee_name
        FROM schedules s
        
        LEFT JOIN schedule_employees se
          ON se.schedule_id = s.id
          AND se.deleted_at IS NULL

        LEFT JOIN employees e
          ON e.id = se.employee_id

        WHERE s.id = ?
          AND s.deleted_at IS NULL
    `,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Schedule not found",
      });
    }

    res.status(200).json({
      status: true,
      code: 200,
      message: "Schedule fetched successfully",
      data: {
        id: rows[0].id,
        employees: rows
          .filter((row) => row.employee_id)
          .map((row) => ({
            id: row.employee_id,
            name: row.employee_name,
          })),
        title: rows[0].title,
        type: rows[0].type,
        description: rows[0].description,
        start_date: rows[0].start_date,
        end_date: rows[0].end_date,
        start_time: rows[0].start_time,
        end_time: rows[0].end_time,
        location_type: rows[0].location_type,
        location: rows[0].location,
        online_meeting_link: rows[0].online_meeting_link,
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
