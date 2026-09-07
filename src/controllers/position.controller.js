const pool = require("../config/db");
const Joi = require("joi"); // Mengimpor Joi untuk melakukan validasi query parameter.
const { v4: uuidv4 } = require("uuid");

// GET ALL POSITIONS

/**
 * @swagger
 * /api/positions:
 *    get:
 *      summary: Get all positions
 *      tags: [Positions]
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
 *          description: Successfully retrieved positions
 *        400:
 *          description: Invalid request parameters
 *        500:
 *          description: Internal server error
 */

const getAllPositions = async (req, res) => {
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

    const allowedFilterFields = ["name", "department"];

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
    const filterPositionName = parsedFilter.name || "";
    const filterDepartmentName = parsedFilter.department?.name || "";

    const limit = param.limit;

    // Menghitung offset berdasarkan page dan limit.
    const offset = (param.page - 1) * limit;

    // Daftar kolom yang boleh digunakan untuk sorting.
    // const allowedOrderFields = [
    //   "id",
    //   "name",
    //   "created_at",
    //   "created_by",
    //   "updated_at",
    //   "updated_by",
    //   "deleted_at",
    //   "deleted_by",
    // ];

    const allowedOrderFields = {
      id: "p.id",
      name: "p.name",
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

    const [rows] = await pool.query(
      `
        SELECT p.*, 
          d.id AS department_id, 
          d.name AS department_name 
        FROM positions p 
        INNER JOIN departments d 
        ON p.department_id = d.id 
        WHERE (
          p.name LIKE ? 
          OR d.name LIKE ?
        )
        ${deletedCondition}
        ORDER BY ${allowedOrderFields[param.order_field]} ${param.order_direction}
        LIMIT ${limit} OFFSET ${offset}
      `,
      [`%${filterPositionName}%`, `%${filterDepartmentName}%`],
    );

    const [[{ total }]] = await pool.query(
      `
        SELECT COUNT(*) as total
        FROM positions p
        INNER JOIN departments d
        ON p.department_id = d.id
        WHERE (
          p.name LIKE ?
          OR d.name LIKE ?
        )
        ${deletedCondition}
      `,
      [`%${filterPositionName}%`, `%${filterDepartmentName}%`],
    );

    res.status(200).json({
      status: true,
      code: 200,
      message: "Positions fetched successfully",
      data: {
        count: rows.length,
        page: param.page,
        total_count: total,
        list: rows.map((row) => ({
          id: row.id,
          name: row.name,
          department: {
            id: row.department_id,
            name: row.department_name,
          },
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

// GET POSITION BY ID

/**
 * @swagger
 * /api/positions/{id}:
 *    get:
 *      summary: Get position by ID
 *      tags: [Positions]
 *      parameters:
 *        - in: path
 *          name: id
 *          required: true
 *          schema:
 *            type: string
 *          description: Position ID
 *      responses:
 *        200:
 *          description: Successfully retrieved position
 *        404:
 *          description: Position not found
 *        500:
 *          description: Internal server error
 */

const getPositionById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `
        SELECT 
          p.* ,
          d.id AS department_id,
          d.name AS department_name,
          d.created_at AS department_created_at,
          d.created_by AS department_created_by,
          d.updated_at AS department_updated_at,
          d.updated_by AS department_updated_by
        FROM positions p 
        INNER JOIN departments d 
          ON p.department_id = d.id 
        WHERE p.id = ?
      `,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Position not found",
      });
    }

    const row = rows[0];

    res.status(200).json({
      status: true,
      code: 200,
      message: "Position fetched successfully",
      data: {
        id: row.id,
        name: row.name,

        department: {
          id: row.department_id,
          name: row.department_name,
          created_at: row.department_created_at,
          created_by: row.department_created_by,
          updated_at: row.department_updated_at,
          updated_by: row.department_updated_by,
        },

        created_at: row.created_at,
        created_by: row.created_by,
        updated_at: row.updated_at,
        updated_by: row.updated_by,
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

// CREATE POSITION

/**
 * @swagger
 * /api/positions:
 *    post:
 *      summary: Create a new position
 *      tags: [Positions]
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - department_id
 *                - name
 *              properties:
 *                department_id:
 *                  type: string
 *                  example: uuid-string
 *                name:
 *                  type: string
 *                  example: Finance
 *      responses:
 *        201:
 *          description: Successfully created position
 *        400:
 *          description: Name is required
 *        409:
 *          description: Position already exists
 *        500:
 *          description: Internal server error
 */

const createPosition = async (req, res) => {
  try {
    const id = uuidv4();
    const { department_id, name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Name is required",
      });
    }

    const positionName = name.trim();

    const [existing] = await pool.query(
      `
        SELECT id 
        FROM positions 
        WHERE name = ?
      `,
      [positionName],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        status: false,
        code: 409,
        message: "Position already exists",
      });
    }

    if (!department_id) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Department is required",
      });
    }

    const [department] = await pool.query(
      `
        SELECT * 
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

    await pool.query(
      `
        INSERT INTO positions (id, department_id, name) 
        VALUES(?, ?, ?)
      `,
      [id, department_id, positionName],
    );

    const [rows] = await pool.query(
      `
        SELECT 
          p.*,
          d.id AS department_id,
          d.name AS department_name,
          d.created_at AS department_created_at,
          d.created_by AS department_created_by,
          d.updated_at AS department_updated_at,
          d.updated_by AS department_updated_by
        FROM positions p
        INNER JOIN departments d
          ON p.department_id = d.id
        WHERE p.id = ?
      `,
      [id],
    );

    const row = rows[0];

    res.status(201).json({
      status: true,
      code: 201,
      message: "Position created successfully",
      data: {
        id: row.id,
        name: row.name,
        department: {
          id: row.department_id,
          name: row.department_name,
          created_at: row.department_created_at,
          created_by: row.department_created_by,
          updated_at: row.department_updated_at,
          updated_by: row.department_updated_by,
        },

        created_at: row.created_at,
        created_by: row.created_by,
        updated_at: row.updated_at,
        updated_by: row.updated_by,
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

// UPDATE POSITION

/**
 * @swagger
 * /api/positions/{id}:
 *    put:
 *      summary: Update position
 *      tags: [Positions]
 *      parameters:
 *        - in: path
 *          name: id
 *          required: true
 *          schema:
 *            type: string
 *          description: Position ID
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - department_id
 *                - name
 *              properties:
 *                department_id:
 *                  type: string
 *                  example: uuid-string
 *                name:
 *                  type: string
 *                  example: Finance
 *      responses:
 *        200:
 *          description: Successfully updated position
 *        400:
 *          description: Name is required
 *        404:
 *          description: Position not found
 *        409:
 *          description: Position already exists
 *        500:
 *          description: Internal server error
 */

const updatePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { department_id, name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Name is required",
      });
    }

    const positionName = name.trim();

    const [existing] = await pool.query(
      `
        SELECT id 
        FROM positions 
        WHERE name = ? 
          AND id != ?
      `,
      [positionName, id],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        status: false,
        code: 409,
        message: "Position already exists",
      });
    }

    if (!department_id) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Department is required",
      });
    }

    const [department] = await pool.query(
      `
        SELECT * 
        FROM departments 
        WHERE id = ?
      `
        ,
      [department_id],
    );

    if (department.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Department not found",
      });
    }

    const [result] = await pool.query(
      `
        UPDATE positions 
        SET name = ?, department_id = ? 
        WHERE id = ?
      `,
      [positionName, department_id, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Position not found",
      });
    }

    const [rows] = await pool.query(
      `
        SELECT 
          p.*,
          d.id AS department_id,
          d.name AS department_name,
          d.created_at AS department_created_at,
          d.created_by AS department_created_by,
          d.updated_at AS department_updated_at,
          d.updated_by AS department_updated_by
        FROM positions p
        INNER JOIN departments d
          ON p.department_id = d.id
        WHERE p.id = ?
      `,
      [id],
    );

    const row = rows[0];

    res.status(200).json({
      status: true,
      code: 200,
      message: "Position updated successfully",
      data: {
        id: row.id,
        name: row.name,
        department: {
          id: row.department_id,
          name: row.department_name,
          created_at: row.department_created_at,
          created_by: row.department_created_by,
          updated_at: row.department_updated_at,
          updated_by: row.department_updated_by,
        },

        created_at: row.created_at,
        created_by: row.created_by,
        updated_at: row.updated_at,
        updated_by: row.updated_by,
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

// DELETE POSITION

/**
 * @swagger
 * /api/positions/{id}:
 *    delete:
 *      summary: Delete position
 *      tags: [Positions]
 *      parameters:
 *        - in: path
 *          name: id
 *          required: true
 *          schema:
 *            type: string
 *          description: Position ID
 *      responses:
 *        200:
 *          description: Successfully deleted position
 *        404:
 *          description: Position not found
 *        500:
 *          description: Internal server error
 */

const deletePosition = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `
        DELETE FROM positions 
        WHERE id = ?
      `,
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Position not found",
      });
    }

    res.status(200).json({
      status: true,
      code: 200,
      message: "Position deleted successfully",
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
  getAllPositions,
  getPositionById,
  createPosition,
  updatePosition,
  deletePosition,
};
