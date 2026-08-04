const express = require("express");
const router = express.Router();

const {
  getAllLeaves,
  getLeaveById,
  createLeave,
  // updateLeave,
  // deleteLeave,
} = require("../controllers/leave.controller");

router.get("/", getAllLeaves);
router.get("/:id", getLeaveById);
router.post("/", createLeave);
// router.put("/:id", updateLeave);
// router.delete("/:id", deleteLeave);

module.exports = router;
