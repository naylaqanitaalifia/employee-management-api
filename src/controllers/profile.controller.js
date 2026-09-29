const pool = require("../config/db");
const Joi = require("joi"); // Mengimpor Joi untuk melakukan validasi query parameter.
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");

// GET PROFILE

/**
 * @swagger
 * /api/employees:
 *    get:
 *      summary: Get profile
 *      tags: [Profile]
 *      parameters:
 *        - in: query
 *          name: filter
 *          required: false
 *          schema:
 *            type: string
 *        - in: query
 *          name: limit
 *          required: true
 *          schema:
 *            type: number
 *        - in: query
 *          name: page
 *          required: true
 *          schema:
 *            type: number
 *        - in: query
 *          name: with_deleted
 *          required: true
 *          schema:
 *            type: boolean
 *        - in: query
 *          name: order_field
 *          required: true
 *          schema:
 *            type: string
 *        - in: query
 *          name: order_direction
 *          required: true
 *          schema:
 *            type: string
 *            enum: [ASC, DESC]
 *      responses:
 *        200:
 *          description: Successfully retrieved employees
 *        400:
 *          description: Invalid request parameters
 *        500:
 *          description: Internal server error
 */

const getProfile = async (req, res) => {
  try {
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
      id: "e.id",
      name: "e.name",
      created_at: "e.created_at",
      created_by: "e.created_by",
      updated_at: "e.updated_at",
      updated_by: "e.updated_by",
      deleted_at: "e.deleted_at",
      deleted_by: "e.deleted_by",
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
      : "AND e.deleted_at IS NULL";

    const [rows] = await pool.query(
      `
        SELECT 
            e.id, 
            e.name, 
            e.email, 
            e.phone, 
            d.id AS department_id, 
            d.name AS department_name, 
            p.id AS position_id, 
            p.name AS position_name,
            e.status,
            e.address,
            e.created_at,
            e.updated_at,
            e.deleted_at
        FROM employees e
        INNER JOIN departments d 
          ON e.department_id = d.id
        INNER JOIN positions p 
          ON e.position_id = p.id
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
        SELECT COUNT(*) as total
        FROM employees e
        INNER JOIN departments d
          ON e.department_id = d.id
        INNER JOIN positions p
          ON e.position_id = p.id
        WHERE e.name LIKE ?
        ${deletedCondition}
      `,
      [`%${filterName}%`],
    );

    res.status(200).json({
      status: true,
      code: 200,
      message: "Employees fetched successfully",
      data: {
        count: rows.length,
        page: param.page,
        total_count: total,
        list: rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          department: {
            id: row.department_id,
            name: row.department_name,
          },
          position: {
            id: row.position_id,
            name: row.position_name,
          },
          // contract_type: row.contract_type,
          // start_date: row.start_date,
          status: row.status,
          // account_number: row.account_number,
          address: row.address,
          created_at: row.created_at,
          updated_at: row.updated_at,
          deleted_at: row.deleted_at,
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

// UPDATE PROFILE

/**
 * @swagger
 * /api/profile:
 *    put:
 *      summary: Update profile
 *      tags: [Profile]
 *      parameters:
 *        - in: path
 *          name: id
 *          required: true
 *          schema:
 *            type: string
 *          description: Employee ID
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - name
 *                - email
 *                - phone
 *                - department_id
 *                - position_id
 *                - contract_type
 *                - start_date
 *                - status
 *                - account_number
 *                - address
 *              properties:
 *                name:
 *                  type: string
 *                  example: Employee Name
 *                email:
 *                  type: string
 *                  example: example@gmail.com
 *                phone:
 *                  type: string
 *                  example: +6281234567890
 *                department_id:
 *                  type: string
 *                  example: uuid-string
 *                position_id:
 *                  type: string
 *                  example: uuid-string
 *                contract_type:
 *                  type: string
 *                  enum:
 *                    - permanent
 *                    - contract
 *                    - internship
 *                  example: permanent
 *                start_date:
 *                  type: string
 *                  example: 2026-08-24
 *                status:
 *                  type: string
 *                  enum:
 *                    - active
 *                    - on_leave
 *                    - resigned
 *                    - terminated
 *                  example: active
 *                account_number:
 *                  type: string
 *                  nullable: true
 *                  example: 1234567890 | null
 *                address:
 *                  type: string
 *                  example: Jl. Raya Pajajaran No. 10, Bogor
 *      responses:
 *        200:
 *          description: Successfully updated employee
 *        400:
 *          description: Name is required
 *        404:
 *          description: Employee not found
 *        409:
 *          description: Employee already exists
 *        500:
 *          description: Internal server error
 */

const updateProfile = async (req, res) => {
  try {
    const { id } = req.user;
    const { phone, birth_date, address } = req.body;

    const [users] = await pool.query(
      `
        SELECT employee_id
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [id],
    );

    if (users.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "User not found",
      });
    }

    const employeeId = users[0].employee_id;

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Phone is required",
      });
    }

    if (!birth_date) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Birth date is required",
      });
    }

    if (!address || !address.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Address is required",
      });
    }

    const [existingPhone] = await pool.query(
      "SELECT id FROM employees WHERE phone = ? AND id != ?",
      [phone.trim(), id],
    );

    if (existingPhone.length > 0) {
      return res.status(409).json({
        status: false,
        code: 409,
        message: "Phone already exists",
      });
    }

    await pool.query(
      `
        UPDATE employees 
        SET 
          phone = ?, 
          birth_date = ?, 
          address = ?
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [phone.trim(), birth_date, address.trim(), employeeId],
    );

    // if (result.affectedRows === 0) {
    //   return res.status(404).json({
    //     message: "Employee not found",
    //   });
    // }

    res.status(200).json({
      status: true,
      code: 200,
      message: "Profile updated successfully",
      data: {
        id: employeeId,
        phone: phone.trim(),
        birth_date,
        address: address.trim(),
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
