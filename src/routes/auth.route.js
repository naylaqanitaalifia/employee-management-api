const express = require("express");
const {
  login,
  refreshToken,
  updatePassword,
} = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth-middleware");

const router = express.Router();

router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.patch("/update-password", authMiddleware, updatePassword);

module.exports = router;
