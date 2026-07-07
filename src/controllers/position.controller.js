const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const getAllPositions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.size) || 10;
    const search = req.query.search || "";

    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT p.*, d.id AS department_id, d.name AS department_name FROM positions p INNER JOIN departments d ON p.department_id = d.id WHERE p.name LIKE ? OR d.name LIKE ? ORDER BY p.created_at DESC LIMIT ? OFFSET ?",
      [`%${search}%`, `%${search}%`, limit, offset],
    );

    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) as total FROM positions",
    );

    res.status(200).json({
      status: true,
      code: 200,
      message: "Data has been successfully fetched",
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        department: {
          id: row.department_id,
          name: row.department_name,
        },
        created_at: row.created_at,
        updated_at: row.updated_at,
        // deleted_at: row.deleted_at,
      })),
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

const getPositionById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT  p.id, p.name, d.id AS department_id, d.name AS department_name FROM positions p INNER JOIN departments d ON p.department_id = d.id WHERE p.id = ?",
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Position not found",
      });
    }

    res.status(200).json({
      message: "Position fetched successfully",
      data: {
        id: rows[0].id,
        name: rows[0].name,
        department: {
          id: rows[0].department_id,
          name: rows[0].department_name,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// CREATE POSITION
const createPosition = async (req, res) => {
  try {
    const id = uuidv4();
    const { department_id, name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Name is required",
      });
    }

    const positionName = name.trim();

    const [existing] = await pool.query(
      "SELECT id FROM positions WHERE name = ?",
      [positionName],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: "Position already exists",
      });
    }

    if (!department_id) {
      return res.status(400).json({
        message: "Department is required",
      });
    }

    const [department] = await pool.query(
      "SELECT * FROM departments WHERE id = ?",
      [department_id],
    );

    if (department.length === 0) {
      return res.status(404).json({
        message: "Department not found",
      });
    }

    await pool.query(
      `INSERT INTO positions (id, department_id, name) VALUES(?, ?, ?)`,
      [id, department_id, positionName],
    );

    res.status(201).json({
      message: "Position created successfully",
      data: {
        id,
        name: positionName,
        department: {
          id: department[0].id,
          name: department[0].name,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const updatePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { department_id, name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Name is required",
      });
    }

    const positionName = name.trim();

    const [existing] = await pool.query(
      "SELECT id FROM positions WHERE name = ? AND id != ?",
      [positionName, id],
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: "Position already exists",
      });
    }

    if (!department_id) {
      return res.status(400).json({
        message: "Department is required",
      });
    }

    const [department] = await pool.query(
      "SELECT * FROM departments WHERE id = ?",
      [department_id],
    );

    if (department.length === 0) {
      return res.status(404).json({
        message: "Department not found",
      });
    }

    const [result] = await pool.query(
      `UPDATE positions SET name = ?, department_id = ?  WHERE id = ?`,
      [positionName, department_id, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Position not found",
      });
    }

    res.status(200).json({
      message: "Position updated successfully",
      data: {
        id,
        name: positionName,
        department: {
          id: department[0].id,
          name: department[0].name,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const deletePosition = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query("DELETE FROM positions WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Position not found",
      });
    }

    res.status(200).json({
      message: "Position deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
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
