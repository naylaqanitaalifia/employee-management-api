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
            u.role,
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

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    if (!process.env.JWT_REFRESH_SECRET) {
      throw new Error("JWT_REFRESH_SECRET is not configured");
    }

    const accessToken = jwt.sign(
      {
        id: user.id,
        employee_id: user.employee_id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "15m",
      },
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: "7d",
      },
    );

    res.status(200).json({
      status: true,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          employee_id: user.employee_id,
          email: user.email,
          name: user.employee_name,
          role: user.role,
        },
        role_name: user.role,
        token: {
          access_token: accessToken,
          refresh_token: refreshToken,
        },
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

const refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        status: false,
        code: 400,
        message: "Refresh token is required",
      });
    }

    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);

    const [users] = await pool.query(
      `
        SELECT 
          u.id,
          u.employee_id,
          u.role,
          e.name AS employee_name,
          e.email
        FROM users u
        INNER JOIN employees e
            ON u.employee_id = e.id
        WHERE u.id = ?
      `,
      [decoded.id],
    );

    if (users.length === 0) {
      return res.status(401).json({
        status: false,
        code: 401,
        message: "Invalid refresh token",
      });
    }

    const user = users[0];

    const newAccessToken = jwt.sign(
      {
        id: user.id,
        employee_id: user.employee_id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "15m",
      },
    );

    return res.status(200).json({
      status: true,
      code: 200,
      message: "Token refreshed successfully",
      data: {
        access_token: newAccessToken,
      },
    });
  } catch (error) {
    return res.status(401).json({
      status: false,
      code: 401,
      message: "Invalid or expired refresh token",
    });
  }
};

module.exports = {
  login,
  refreshToken,
};
