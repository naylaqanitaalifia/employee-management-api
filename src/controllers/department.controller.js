const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// GET ALL DEPARTMENTS
const getAllDepartments = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM departments ORDER BY name ASC",
    );

    res.status(200).json({
      message: "Department fetched successfully",
      data: rows,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// GET DEPARTMENT BY ID
const getDepartmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query("SELECT * FROM departments WHERE id = ?", [
      id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Department not found",
      });
    }

    res.status(200).json({
      message: "Department fetched successfully",
      data: rows[0],
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// CREATE DEPARTMENT
const createDepartment = async (req, res) => {
  try {
    const id = uuidv4();
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
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
        message: "Department already exists",
      });
    }

    await pool.query(`INSERT INTO departments (id, name) VALUES(?, ?)`, [
      id,
      departmentName,
    ]);

    res.status(201).json({
      message: "Department created successfully",
      data: {
        id,
        name: departmentName,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// UPDATE DEPARTMENT
const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Name is required",
      });
    }

    const departmentName = name.trim();

    const [existing] = await pool.query(
      "SELECT id FROM departments WHERE name = ? AND id != ?",
      [departmentName, id],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: "Department already exists",
      });
    }

    const [result] = await pool.query(
      `UPDATE departments SET name = ? WHERE id = ?`,
      [departmentName, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Department not found",
      });
    }

    res.status(200).json({
      message: "Department updated successfully",
      data: {
        id,
        name: departmentName,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// DELETE DEPARTMENT
const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(`DELETE FROM departments WHERE id = ?`, [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Department not found",
      });
    }

    res.status(200).json({
      message: "Department deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
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
