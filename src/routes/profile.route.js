const express = require("express");
const router = express.Router();

const {
  getProfile,
  updateProfile,
} = require("../controllers/profile.controller");

router.get("/", getProfile);
router.patch("/:id", updateProfile);

module.exports = router;
