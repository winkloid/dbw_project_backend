const express = require("express");
const router = express.Router();
const {
    uploadFile,
    fileMetaData,
    fileViaId,
    requestBlockingStatusChange
} = require("../controllers/file.controller");
const {request} = require("express");

router.post("/uploadFile", uploadFile);

router.get("/fileMetaData/:id", fileMetaData);

router.get("/downloadFileViaId/:id", fileViaId);

router.post("/requestBlockingStatusChange/:id", requestBlockingStatusChange);

module.exports = router;
