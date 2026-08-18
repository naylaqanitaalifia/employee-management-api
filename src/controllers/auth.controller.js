const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Email is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Password is required",
      });
    }

    const [users] = await pool.query(
      `
        SELECT 
            u.id,
            u.employee_id,
            u.password,
            e.name AS employee_name,
            e.email
        FROM users u
        INNER JOIN employees e
            ON u.employee_id = e.id
        WHERE e.email = ?
        `,
      [email.trim()],
    );

    if (users.length === 0) {
      return res.status(401).json({
        status: false,
        code: 401,
        message: "Invalid email or password",
      });
    }

    const user = users[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: false,
        code: 401,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        employee_id: user.employee_id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      },
    );

    res.status(200).json({
      status: true,
      message: "Login successful",
      data: {
        id: user.id,
        employee_id: user.employee_id,
        email: user.email,
        name: user.employee_name,
        token,
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
  login,
};
