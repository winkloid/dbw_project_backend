const express = require("express");
const router = express.Router();
const {
    uploadFile,
} = require("../controllers/file.controller");

router.post("/uploadFile", uploadFile);

module.exports = router;
