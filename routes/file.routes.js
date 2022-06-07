const express = require("express");
const router = express.Router();
const {
    uploadFile,
    fileMetaData,
} = require("../controllers/file.controller");

router.post("/uploadFile", uploadFile);

router.get("/fileMetaData/:id", fileMetaData);

module.exports = router;
