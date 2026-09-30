const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload-middleware");

const {
  getProfile,
  updateProfile,
  updateProfilePhoto,
} = require("../controllers/profile.controller");

router.get("/", getProfile);
router.patch("/", updateProfile);
router.patch("/photo", upload.single("photo"), updateProfilePhoto);

module.exports = router;
