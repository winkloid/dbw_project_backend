const express = require("express");
const router = express.Router();
const {
    uploadFile,
    fileMetaData,
    fileViaId,
} = require("../controllers/file.controller");

router.post("/uploadFile", uploadFile);

router.get("/fileMetaData/:id", fileMetaData);

router.get("/downloadFileViaId/:id", fileViaId);

module.exports = router;
