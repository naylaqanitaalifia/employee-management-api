const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// GET ALL EMPLOYEES
const getAllEmployees = async (req, res) => {
  try {
    const [rows] = await pool.query(`
        SELECT 
            e.id, 
            e.name, 
            e.email, 
            e.phone, 
            d.id AS department_id, 
            d.name AS department_name, 
            p.id AS position_id, 
            p.name AS position_name,
            e.contract_type, 
            e.start_date,
            e.status,
            e.account_number,
            e.address
        FROM employees e
        INNER JOIN departments d ON e.department_id = d.id
        INNER JOIN positions p ON e.position_id = p.id
        ORDER BY e.created_at DESC
    `);

    res.status(200).json({
      message: "Employee fetched successfully",
      data: rows.map((row) => ({
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
        contract_type: row.contract_type,
        start_date: row.start_date,
        status: row.status,
        account_number: row.account_number,
        address: row.address,
      })),
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// GET EMPLOYEE BY ID
const getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;

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
            e.contract_type, 
            e.start_date,
            e.status,
            e.account_number,
            e.address
        FROM employees e
        INNER JOIN departments d ON e.department_id = d.id
        INNER JOIN positions p ON e.position_id = p.id
        WHERE e.id = ?
    `,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    const employee = rows[0];
    res.status(200).json({
      message: "Employee fetched successfully",
      data: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        department: {
          id: employee.department_id,
          name: employee.department_name,
        },
        position: {
          id: employee.position_id,
          name: employee.position_name,
        },
        contract_type: employee.contract_type,
        start_date: employee.start_date,
        status: employee.status,
        account_number: employee.account_number,
        address: employee.address,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const createEmployee = async (req, res) => {
  try {
    const id = uuidv4();
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
        message: "Name is required",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const [existingEmail] = await pool.query(
      "SELECT id FROM employees WHERE email = ?",
      [email.trim()],
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        message: "Phone is required",
      });
    }

    const [existingPhone] = await pool.query(
      "SELECT id FROM employees WHERE phone = ?",
      [phone.trim()],
    );

    if (existingPhone.length > 0) {
      return res.status(409).json({
        message: "Phone already exists",
      });
    }

    if (!department_id) {
      return res.status(400).json({
        message: "Department is required",
      });
    }

    if (!position_id) {
      return res.status(400).json({
        message: "Position is required",
      });
    }

    if (!contract_type || !contract_type.trim()) {
      return res.status(400).json({
        message: "Contract type is required",
      });
    }

    if (!start_date) {
      return res.status(400).json({
        message: "Start date is required",
      });
    }

    if (!status || !status.trim()) {
      return res.status(400).json({
        message: "Status is required",
      });
    }

    // if (account_number || !account_number.trim()) {
    //   return res.status(400).json({
    //     message: "Account number cannot be empty spaces",
    //   });
    // }

    if (!address || !address.trim()) {
      return res.status(400).json({
        message: "Address is required",
      });
    }

    const [department] = await pool.query(
      "SELECT id, name FROM departments WHERE id = ?",
      [department_id],
    );

    if (department.length === 0) {
      return res.status(404).json({
        message: "Department not found",
      });
    }

    const [position] = await pool.query(
      "SELECT id, name FROM positions WHERE id = ? AND department_id = ?",
      [position_id, department_id],
    );

    if (position.length === 0) {
      return res.status(404).json({
        message: "Position not found",
      });
    }

    await pool.query(
      "INSERT INTO employees (id, name, email, phone, department_id, position_id, contract_type, start_date, status, account_number, address) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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

    res.status(201).json({
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
        account_number: account_number.trim(),
        address: address.trim(),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

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
        message: "Employee not found",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Name is required",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const [existingEmail] = await pool.query(
      "SELECT id FROM employees WHERE email = ? AND id != ?",
      [email.trim(), id],
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        message: "Phone is required",
      });
    }

    const [existingPhone] = await pool.query(
      "SELECT id FROM employees WHERE phone = ? AND id != ?",
      [phone.trim(), id],
    );

    if (existingPhone.length > 0) {
      return res.status(409).json({
        message: "Phone already exists",
      });
    }

    if (!department_id) {
      return res.status(400).json({
        message: "Department is required",
      });
    }

    if (!position_id) {
      return res.status(400).json({
        message: "Position is required",
      });
    }

    if (!contract_type || !contract_type.trim()) {
      return res.status(400).json({
        message: "Contract type is required",
      });
    }

    if (!start_date) {
      return res.status(400).json({
        message: "Start date is required",
      });
    }

    if (!status || !status.trim()) {
      return res.status(400).json({
        message: "Status is required",
      });
    }

    // if (!account_number || !account_number.trim()) {
    //   return res.status(400).json({
    //     message: "Account number is required",
    //   });
    // }

    if (!address || !address.trim()) {
      return res.status(400).json({
        message: "Address is required",
      });
    }

    const [department] = await pool.query(
      "SELECT id, name FROM departments WHERE id = ?",
      [department_id],
    );

    if (department.length === 0) {
      return res.status(404).json({
        message: "Department not found",
      });
    }

    const [position] = await pool.query(
      "SELECT id, name FROM positions WHERE id = ? AND department_id = ?",
      [position_id, department_id],
    );

    if (position.length === 0) {
      return res.status(404).json({
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
        // account_number && account_number.trim() ? account_number.trim() : null,
        account_number,
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
        account_number: account_number.trim(),
        address: address.trim(),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query("DELETE FROM employees WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    res.status(200).json({
      message: "Employee deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
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
