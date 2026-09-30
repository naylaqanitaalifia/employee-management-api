const express = require("express");
const router = express.Router();

const {
  getProfile,
  updateProfile,
  updateProfilePhoto,
} = require("../controllers/profile.controller");

router.get("/", getProfile);
router.patch("/", updateProfile);
router.patch("/photo", upload.single("photo"), updateProfilePhoto);

module.exports = router;
