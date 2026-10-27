const e = require("cors");
const pool = require("../config/db"); // Mengimpor koneksi database MySQL.
const Joi = require("joi"); // Mengimpor Joi untuk melakukan validasi query parameter.
const { v4: uuidv4 } = require("uuid");

// GET ALL ATTENDANCES

const getAllAttendances = async (req, res) => {
  try {
    const schema = Joi.object({
      filter: Joi.string().allow("").optional(),
      limit: Joi.number().min(1).required(),
      page: Joi.number().min(1).required(),
      //   with_deleted: Joi.boolean().required(),
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

    const allowedFilterFields = ["search", "name"];

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

    const searchKeyword = parsedFilter.search || parsedFilter.name;
    ("");

    let whereConditions = [];
    let queryParams = [];

    if (searchKeyword) {
      whereConditions.push(`(e.name LIKE ?)`);
      queryParams.push(`%${searchKeyword}%`);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const limit = param.limit;

    // Menghitung offset berdasarkan page dan limit.
    const offset = (param.page - 1) * limit;

    // Daftar kolom yang boleh digunakan untuk sorting.
    const allowedOrderFields = {
      id: "a.id",
      name: "e.name",
      employee_id: "a.employee_id",
      attendance_date: "a.attendance_date",
      clock_in: "a.clock_in",
      clock_out: "a.clock_out",
      status: "a.status",
      created_at: "a.created_at",
      created_by: "a.created_by",
      updated_at: "a.updated_at",
      updated_by: "a.updated_by",
    };

    // Memastikan field sorting valid.
    if (!allowedOrderFields[param.order_field]) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Invalid order field",
      });
    }

    // const deletedCondition = param.with_deleted
    //   ? ""
    //   : "AND p.deleted_at IS NULL";

    const [rows] = await pool.query(
      `
        SELECT a.*,
            e.name AS employee_name,
            e.photo AS employee_photo
        FROM attendances a
        WHERE name LIKE ?
        INNER JOIN employees e
        ON a.employee_id = e.id
        ${whereClause}
        ORDER BY ${allowedOrderFields[param.order_field]} ${param.order_direction}
        LIMIT ${limit} OFFSET ${offset}
      `,
      queryParams,
    );

    const [[{ total }]] = await pool.query(
      `
        SELECT COUNT(*) as total
        FROM attendances a
        INNER JOIN employees e
        ON a.employee_id = e.id
        ${whereClause}
      `,
      queryParams,
    );

    res.status(200).json({
      status: true,
      code: 200,
      message: "Attendances fetched successfully",
      data: {
        count: rows.length,
        page: param.page,
        total_count: total,
        list: rows.map((row) => ({
          id: row.id,
          employee: {
            id: row.employee_id,
            name: row.employee_name,
            photo: row.employee_photo,
          },
          attendance_date: row.attendance_date,
          clock_in: row.clock_in,
          clock_out: row.clock_out,
          status: row.status,
          created_at: row.created_at,
          updated_at: row.updated_at,
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

const getTodayAttendances = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;

    if (!employeeId) {
      return res.status(400).json({
        status: false,
        code: 404,
        message: "Employee not found",
      });
    }

    const [rows] = await pool.query(
      `
        SELECT 
          id,
          employee_id,
          attendance_date,
          clock_in,
          clock_out,
          status
        FROM attendances
        WHERE employee_id = ?
          AND attendance_date = CURDATE()
        LIMIT 1
      `,
      [employeeId],
    );

    return res.status(200).json({
      status: true,
      code: 200,
      message: "Today's attendance fetched successfully",
      data: rows[0] ?? null,
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

const clockIn = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const userId = req.user.id;

    if (!employeeId) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Employee not found",
      });
    }

    const [employee] = await pool.query(
      `
            SELECT id, name FROM employees
            WHERE id = ?
        `,
      [employeeId],
    );

    if (employee.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Employee not found",
      });
    }

    const [attendances] = await pool.query(
      `
            SELECT id, clock_in
            FROM attendances
            WHERE employee_id = ?
                AND attendance_date = CURDATE()
        `,
      [employeeId],
    );

    if (attendances.length > 0) {
      return res.status(409).json({
        status: false,
        code: 409,
        message: "You have already clocked in today",
      });
    }

    const attendanceId = uuidv4();

    await pool.query(
      `
            INSERT INTO attendances (
                id,
                employee_id,
                attendance_date,
                clock_in,
                created_by
            )
            VALUES (?, ?, CURDATE(), NOW(), ?)
        `,
      [attendanceId, employeeId, userId],
    );

    const [newAttendance] = await pool.query(
      `
            SELECT
                id,
                employee_id,
                attendance_date,
                clock_in,
                clock_out,
                status
            FROM attendances
            WHERE id = ?
        `,
      [attendanceId],
    );

    return res.status(201).json({
      status: true,
      code: 201,
      message: "Attendance clocked in successfully",
      data: newAttendance[0],
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        status: false,
        code: 409,
        message: "You have already clocked in today",
      });
    }

    res.status(500).json({
      status: false,
      code: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const clockOut = async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const userId = req.user.id;

    if (!employeeId) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Employee not found",
      });
    }

    const [employee] = await pool.query(
      `
            SELECT id, name FROM employees
            WHERE id = ?
        `,
      [employeeId],
    );

    if (employee.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Employee not found",
      });
    }

    const [attendance] = await pool.query(
      `
            SELECT id, clock_in, clock_out
            FROM attendances
            WHERE employee_id = ?
                AND attendance_date = CURDATE()
        `,
      [employeeId],
    );

    if (attendance.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "You have not clocked in today",
      });
    }

    const currentAttendance = attendance[0];

    if (currentAttendance.clock_out !== null) {
      return res.status(409).json({
        status: false,
        code: 409,
        message: "You have already clocked out today",
      });
    }

    await pool.query(
      `
            UPDATE attendances 
            SET clock_out = NOW(),
                updated_by = ?
            WHERE id = ?
        `,
      [userId, currentAttendance.id],
    );

    const [updatedAttendance] = await pool.query(
      `
            SELECT
                id,
                employee_id,
                attendance_date,
                clock_in,
                clock_out,
                status
            FROM attendances
            WHERE id = ?
        `,
      [currentAttendance.id],
    );

    return res.status(200).json({
      status: true,
      code: 200,
      message: "Attendance clocked out successfully",
      data: updatedAttendance[0],
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
  getAllAttendances,
  getTodayAttendances,
  clockIn,
  clockOut,
};
