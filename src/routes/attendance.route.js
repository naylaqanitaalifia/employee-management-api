const express = require("express");
const router = express.Router();

const {
  getAllAttendances,
  getTodayAttendances,
  clockIn,
  clockOut,
} = require("../controllers/attendance.controller");

router.get("/", getAllAttendances);
router.get("/today", getTodayAttendances);
router.post("/clock-in", clockIn);
router.post("/clock-out", clockOut);

module.exports = router;
