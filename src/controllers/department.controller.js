const pool = require("../config/db"); // Mengimpor koneksi database MySQL.
const Joi = require("joi"); // Mengimpor Joi untuk melakukan validasi query parameter.
const { v4: uuidv4 } = require("uuid");

// GET ALL DEPARTMENTS

/**
 * @swagger
 * /api/departments:
 *    get:
 *      summary: Get all departments
 *      tags: [Departments]
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
 *          description: Successfully retrieved departments
 *        400:
 *          description: Invalid request parameters
 *        500:
 *          description: Internal server error
 */

const getAllDepartments = async (req, res) => {
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
    const allowedOrderFields = [
      "id",
      "name",
      "created_at",
      "created_by",
      "updated_at",
      "updated_by",
      "deleted_at",
      "deleted_by",
    ];

    // Memastikan field sorting valid.
    if (!allowedOrderFields.includes(param.order_field)) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Invalid order field",
      });
    }

    const deletedCondition = param.with_deleted ? "" : "AND deleted_at IS NULL";

    const [rows] = await pool.query(
      `
        SELECT *
        FROM departments
        WHERE name LIKE ?
        ${deletedCondition}
        ORDER BY ${param.order_field} ${param.order_direction}
        LIMIT ${limit} OFFSET ${offset}
      `,
      [`%${filterName}%`],
    );

    const [[{ total }]] = await pool.query(
      `
        SELECT COUNT(*) as total
        FROM departments
        WHERE name LIKE ?
        ${deletedCondition}
      `,
      [`%${filterName}%`],
    );

    res.status(200).json({
      status: true,
      code: 200,
      message: "Departments fetched successfully",
      data: {
        count: rows.length,
        page: param.page,
        total_count: total,
        list: rows,
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

// GET DEPARTMENT BY ID

/**
 * @swagger
 * /api/departments/{id}:
 *    get:
 *      summary: Get department by ID
 *      tags: [Departments]
 *      parameters:
 *        - in: path
 *          name: id
 *          required: true
 *          schema:
 *            type: string
 *          description: Department ID
 *      responses:
 *        200:
 *          description: Successfully retrieved department
 *        404:
 *          description: Department not found
 *        500:
 *          description: Internal server error
 */

const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query("SELECT * FROM departments WHERE id = ?", [
      id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Department not found",
      });
    }

    res.status(200).json({
      status: true,
      code: 200,
      message: "Department fetched successfully",
      data: rows[0],
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

// CREATE DEPARTMENT

/**
 * @swagger
 * /api/departments:
 *    post:
 *      summary: Create a new department
 *      tags: [Departments]
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - name
 *              properties:
 *                name:
 *                  type: string
 *                  example: Finance
 *      responses:
 *        201:
 *          description: Successfully created department
 *        400:
 *          description: Name is required
 *        409:
 *          description: Department already exists
 *        500:
 *          description: Internal server error
 */

const createDepartment = async (req, res) => {
  try {
    const id = uuidv4();
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Name is required",
      });
    }

    const departmentName = name.trim();

    const [existing] = await pool.query(
      "SELECT id FROM departments WHERE name = ?",
      [departmentName],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        status: false,
        code: 409,
        message: "Department already exists",
      });
    }

    await pool.query(
      `
        INSERT INTO departments (id, name) 
        VALUES(?, ?)
      `,
      [id, departmentName],
    );

    const [rows] = await pool.query(
      `
        SELECT * 
        FROM departments
        WHERE id = ?
      `,
      [id],
    );

    res.status(201).json({
      status: true,
      code: 201,
      message: "Department created successfully",
      data: rows[0],
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

// UPDATE DEPARTMENT

/**
 * @swagger
 * /api/departments/{id}:
 *    put:
 *      summary: Update department
 *      tags: [Departments]
 *      parameters:
 *        - in: path
 *          name: id
 *          required: true
 *          schema:
 *            type: string
 *          description: Department ID
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - name
 *              properties:
 *                name:
 *                  type: string
 *                  example: Finance
 *      responses:
 *        200:
 *          description: Successfully updated department
 *        400:
 *          description: Name is required
 *        404:
 *          description: Department not found
 *        409:
 *          description: Department already exists
 *        500:
 *          description: Internal server error
 */

const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Name is required",
      });
    }

    const departmentName = name.trim();

    const [existing] = await pool.query(
      `
        SELECT id 
        FROM departments 
        WHERE name = ? 
        AND id != ?
      `,
      [departmentName, id],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        status: false,
        code: 409,
        message: "Department already exists",
      });
    }

    const [result] = await pool.query(
      `
        UPDATE departments 
        SET name = ? 
        WHERE id = ?
      `,
      [departmentName, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Department not found",
      });
    }

    const [rows] = await pool.query(
      `
        SELECT *
        FROM departments
        WHERE id = ?
      `,
      [id],
    );

    res.status(200).json({
      status: true,
      code: 200,
      message: "Department updated successfully",
      data: rows[0],
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

// DELETE DEPARTMENT

/**
 * @swagger
 * /api/departments/{id}:
 *    delete:
 *      summary: Delete department
 *      tags: [Departments]
 *      parameters:
 *        - in: path
 *          name: id
 *          required: true
 *          schema:
 *            type: string
 *          description: Department ID
 *      responses:
 *        200:
 *          description: Successfully deleted department
 *        404:
 *          description: Department not found
 *        500:
 *          description: Internal server error
 */

const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `
        DELETE FROM departments 
        WHERE id = ?
      `,
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Department not found",
      });
    }

    res.status(200).json({
      status: true,
      code: 200,
      message: "Department deleted successfully",
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
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
