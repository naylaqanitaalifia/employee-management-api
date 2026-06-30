const express = require("express");
const router = express.Router();

const {
  getAllPositions,
  getPositionById,
  createPosition,
  updatePosition,
  deletePosition,
} = require("../controllers/position.controller");

router.get("/", getAllPositions);
router.get("/:id", getPositionById);
router.post("/", createPosition);
router.put("/:id", updatePosition);
router.delete("/:id", deletePosition);

module.exports = router;
