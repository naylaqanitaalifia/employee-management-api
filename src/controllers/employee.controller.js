const pool = require("../config/db");
const Joi = require("joi"); // Mengimpor Joi untuk melakukan validasi query parameter.
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");

const generateTemporaryPassword = (name, phone) => {
  const namePart = name.replace(/\s/g, "").slice(0, 4);
  const phonePart = phone.slice(-4);

  return `${namePart}${phonePart}`;
};

// GET ALL EMPLOYEES

/**
 * @swagger
 * /api/employees:
 *    get:
 *      summary: Get all employees
 *      tags: [Employees]
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

const getAllEmployees = async (req, res) => {
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

// GET EMPLOYEE BY ID

/**
 * @swagger
 * /api/employees/{id}:
 *    get:
 *      summary: Get employee by ID
 *      tags: [Employees]
 *      parameters:
 *        - in: path
 *          name: id
 *          required: true
 *          schema:
 *            type: string
 *          description: Employee ID
 *      responses:
 *        200:
 *          description: Successfully retrieved employee
 *        404:
 *          description: Employee not found
 *        500:
 *          description: Internal server error
 */

const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
        SELECT 
            e.*, 
            d.id AS department_id, 
            d.name AS department_name, 
            d.created_at AS department_created_at,
            d.created_by AS department_created_by,
            d.updated_at AS department_updated_at,
            d.updated_by AS department_updated_by,
            p.id AS position_id, 
            p.name AS position_name,
            p.created_at AS position_created_at,
            p.created_by AS position_created_by,
            p.updated_at AS position_updated_at,
            p.updated_by AS position_updated_by
        FROM employees e
        INNER JOIN departments d 
          ON e.department_id = d.id
        INNER JOIN positions p 
          ON e.position_id = p.id
        WHERE e.id = ?
    `,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Employee not found",
      });
    }

    const row = rows[0];
    res.status(200).json({
      status: true,
      code: 200,
      message: "Employee fetched successfully",
      data: {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        department: {
          id: row.department_id,
          name: row.department_name,
          created_at: row.department_created_at,
          created_by: row.department_created_by,
          updated_at: row.department_updated_at,
          updated_by: row.department_updated_by,
        },
        position: {
          id: row.position_id,
          name: row.position_name,
          created_at: row.position_created_at,
          created_by: row.position_created_by,
          updated_at: row.position_updated_at,
          updated_by: row.position_updated_by,
        },
        contract_type: row.contract_type,
        start_date: row.start_date,
        status: row.status,
        account_number: row.account_number,
        address: row.address,
        created_at: row.created_at,
        created_by: row.created_by,
        updated_at: row.updated_at,
        updated_by: row.updated_by,
        deleted_at: row.deleted_at,
        deleted_by: row.deleted_by,
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

// CREATE EMPLOYEE

/**
 * @swagger
 * /api/employees:
 *    post:
 *      summary: Create a new employee
 *      tags: [Employees]
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
 *        201:
 *          description: Successfully created employee
 *        400:
 *          description: Invalid employee data
 *        404:
 *          description: Invalid employee data
 *        409:
 *          description: Employee already exists
 *        500:
 *          description: Internal server error
 */

const createEmployee = async (req, res) => {
  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    const id = uuidv4();
    const userId = uuidv4();

    const {
      name,
      email,
      phone,
      department_id,
      position_id,
      contract_type,
      start_date,
      status,
      account_number,
      address,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Name is required",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Email is required",
      });
    }

    const [existingEmail] = await pool.query(
      `
        SELECT id 
        FROM employees 
        WHERE email = ?
      `,
      [email.trim()],
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({
        status: false,
        code: 409,
        message: "Email already exists",
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Phone is required",
      });
    }

    const [existingPhone] = await pool.query(
      `
        SELECT id 
        FROM employees 
        WHERE phone = ?
      `,
      [phone.trim()],
    );

    if (existingPhone.length > 0) {
      return res.status(409).json({
        status: false,
        code: 409,
        message: "Phone already exists",
      });
    }

    if (!department_id) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Department is required",
      });
    }

    if (!position_id) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Position is required",
      });
    }

    if (!contract_type || !contract_type.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Contract type is required",
      });
    }

    if (!["permanent", "contract", "internship"].includes(contract_type)) {
      return res.status(400).json({
        status: false,
        code: 400,
        message:
          "Invalid contract type. Allowed values: permanent, contract, internship",
      });
    }

    if (!start_date) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Start date is required",
      });
    }

    if (!status || !status.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Status is required",
      });
    }

    if (!["active", "on_leave", "resigned", "terminated"].includes(status)) {
      return res.status(400).json({
        status: false,
        code: 400,
        message:
          "Invalid status. Allowed values: active, on_leave, resigned, terminated",
      });
    }

    // if (account_number || !account_number.trim()) {
    //   return res.status(400).json({
    //     message: "Account number cannot be empty spaces",
    //   });
    // }

    if (!address || !address.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Address is required",
      });
    }

    const [department] = await pool.query(
      `
        SELECT id, name 
        FROM departments 
        WHERE id = ?
      `,
      [department_id],
    );

    if (department.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Department not found",
      });
    }

    const [position] = await pool.query(
      `
        SELECT id, name 
        FROM positions 
        WHERE id = ? 
          AND department_id = ?
      `,
      [position_id, department_id],
    );

    if (position.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Position not found",
      });
    }

    const temporaryPassword = generateTemporaryPassword(
      name.trim(),
      phone.trim(),
    );

    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    await connection.beginTransaction();
    transactionStarted = true;

    await connection.query(
      `
        INSERT INTO employees (id, name, email, phone, department_id, position_id, contract_type, start_date, status, account_number, address) 
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        name.trim(),
        email.trim(),
        phone.trim(),
        department_id,
        position_id,
        contract_type.trim(),
        start_date,
        status.trim(),
        // account_number && account_number.trim() ? account_number.trim() : null,
        account_number,
        address.trim(),
      ],
    );

    await connection.query(
      `
        INSERT INTO users (
          id,
          employee_id,
          password,
          role
        )
        VALUES(?, ?, ?, ?)
      `,
      [userId, id, hashedPassword, "EMPLOYEE"],
    );

    await connection.commit();

    res.status(201).json({
      status: true,
      code: 201,
      message: "Employee created successfully",
      data: {
        id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department: {
          id: department[0].id,
          name: department[0].name,
        },
        position: {
          id: position[0].id,
          name: position[0].name,
        },
        contract_type: contract_type.trim(),
        start_date,
        status: status.trim(),
        account_number: account_number ? String(account_number).trim() : null,
        address: address.trim(),
        temporary_password: temporaryPassword,
      },
    });
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }

    res.status(500).json({
      status: false,
      code: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

// UPDATE EMPLOYEE

/**
 * @swagger
 * /api/employees/{id}:
 *    put:
 *      summary: Update employee
 *      tags: [Employees]
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

const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      department_id,
      position_id,
      contract_type,
      start_date,
      status,
      account_number,
      address,
    } = req.body;

    const [existing] = await pool.query(
      "SELECT id FROM employees WHERE id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Employee not found",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Name is required",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Email is required",
      });
    }

    const [existingEmail] = await pool.query(
      "SELECT id FROM employees WHERE email = ? AND id != ?",
      [email.trim(), id],
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({
        status: false,
        code: 409,
        message: "Email already exists",
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Phone is required",
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

    if (!department_id) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Department is required",
      });
    }

    if (!position_id) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Position is required",
      });
    }

    if (!contract_type || !contract_type.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Contract type is required",
      });
    }

    if (!["permanent", "contract", "internship"].includes(contract_type)) {
      return res.status(400).json({
        status: false,
        code: 400,
        message:
          "Invalid contract type. Allowed values: permanent, contract, internship",
      });
    }

    if (!start_date) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Start date is required",
      });
    }

    if (!status || !status.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Status is required",
      });
    }

    if (!["active", "on_leave", "resigned", "terminated"].includes(status)) {
      return res.status(400).json({
        status: false,
        code: 400,
        message:
          "Invalid status. Allowed values: active, on_leave, resigned, terminated",
      });
    }

    // if (!account_number || !account_number.trim()) {
    //   return res.status(400).json({
    //     message: "Account number is required",
    //   });
    // }

    if (!address || !address.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Address is required",
      });
    }

    const [department] = await pool.query(
      "SELECT id, name FROM departments WHERE id = ?",
      [department_id],
    );

    if (department.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Department not found",
      });
    }

    const [position] = await pool.query(
      "SELECT id, name FROM positions WHERE id = ? AND department_id = ?",
      [position_id, department_id],
    );

    if (position.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Position not found",
      });
    }

    await pool.query(
      "UPDATE employees SET name = ?, email = ?, phone = ?, department_id = ?, position_id = ?, contract_type = ?, start_date = ?, status = ?, account_number = ?, address = ? WHERE id = ?",
      [
        name.trim(),
        email.trim(),
        phone.trim(),
        department_id,
        position_id,
        contract_type.trim(),
        start_date,
        status.trim(),
        account_number ? String(account_number).trim() : null,
        address.trim(),
        id,
      ],
    );

    // if (result.affectedRows === 0) {
    //   return res.status(404).json({
    //     message: "Employee not found",
    //   });
    // }

    res.status(200).json({
      status: true,
      code: 200,
      message: "Employee updated successfully",
      data: {
        id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        department: {
          id: department[0].id,
          name: department[0].name,
        },
        position: {
          id: position[0].id,
          name: position[0].name,
        },
        contract_type: contract_type.trim(),
        start_date,
        status: status.trim(),
        account_number: account_number ? String(account_number).trim() : null,
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

// DELETE EMPLOYEE

/**
 * @swagger
 * /api/employees/{id}:
 *    delete:
 *      summary: Delete employee
 *      tags: [Employees]
 *      parameters:
 *        - in: path
 *          name: id
 *          required: true
 *          schema:
 *            type: string
 *          description: Employee ID
 *      responses:
 *        200:
 *          description: Successfully deleted employee
 *        404:
 *          description: Employee not found
 *        500:
 *          description: Internal server error
 */

const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `
        DELETE FROM employees 
        WHERE id = ?
      `,
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Employee not found",
      });
    }

    res.status(200).json({
      status: true,
      code: 200,
      message: "Employee deleted successfully",
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
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
