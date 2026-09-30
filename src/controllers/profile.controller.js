const pool = require("../config/db");
const Joi = require("joi"); // Mengimpor Joi untuk melakukan validasi query parameter.
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");

// GET PROFILE

/**
 * @swagger
 * /api/profile:
 *    get:
 *      summary: Get profile
 *      tags: [Profile]
 *      responses:
 *        200:
 *          description: Successfully retrieved profile
 *        404:
 *          description: profile not found
 *        500:
 *          description: Internal server error
 */

const getProfile = async (req, res) => {
  try {
    const { id } = req.user;

    const [rows] = await pool.query(
      `
        SELECT 
            e.*, 
            d.id AS department_id, 
            d.name AS department_name, 
            p.id AS position_id, 
            p.name AS position_name
        FROM users u
        INNER JOIN employees e
          ON e.id = u.employee_id
        INNER JOIN departments d 
          ON e.department_id = d.id
        INNER JOIN positions p 
          ON e.position_id = p.id
        WHERE u.id = ?
          AND e.deleted_at IS NULL
        LIMIT 1
    `,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: false,
        code: 404,
        message: "Profile not found",
      });
    }

    const row = rows[0];

    res.status(200).json({
      status: true,
      code: 200,
      message: "Profile fetched successfully",
      data: {
        id: row.id,
        name: row.name,
        photo: row.photo,
        email: row.email,
        birth_date: row.birth_date,
        phone: row.phone,
        department: {
          id: row.department_id,
          name: row.department_name,
        },
        position: {
          id: row.position_id,
          name: row.position_name,
        },
        contract_type: row.contract_type,
        start_date: row.start_date,
        status: row.status,
        account_number: row.account_number,
        address: row.address,
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
 *    patch:
 *      summary: Update profile
 *      tags: [Profile]
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - phone
 *                - birth_date
 *                - address
 *              properties:
 *                phone:
 *                  type: string
 *                  example: +6281234567890
 *                birth_date:
 *                  type: string
 *                  example: 2026-08-24
 *                address:
 *                  type: string
 *                  example: Jl. Raya Pajajaran No. 10, Bogor
 *      responses:
 *        200:
 *          description: Successfully updated profile
 *        400:
 *          description: Invalid profile data
 *        401:
 *          description: Unauthorized
 *        404:
 *          description: User not found
 *        409:
 *          description: Phone already exists
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
      [phone.trim(), employeeId],
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

const updateProfilePhoto = async (req, res) => {
  try {
    const { id } = req.user;

    if (!req.file) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Profile photo is required",
      });
    }

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
      return res.status(400).json({
        status: false,
        code: 400,
        message: "User not found",
      });
    }

    const employeeId = users[0].employee_id;

    const photoPath = `/uploads/profile/${req.file.filename}`;

    await pool.query(
      `
        UPDATE employees
        SET photo = ?
        WHERE id = ?
          AND deleted_at IS NULL
      `,
      [photoPath, employeeId],
    );
    return res.status(200).json({
      status: true,
      code: 200,
      message: "Profile photo updated successfully",
      data: {
        photo: photoPath,
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
  getProfile,
  updateProfile,
  updateProfilePhoto,
};
