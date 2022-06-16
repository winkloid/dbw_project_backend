const express = require("express");
const router = express.Router();
const {
    authShibboleth,
    uploadFile,
    fileMetaData,
    fileViaId,
    requestBlockingStatusChange,
    blockingStatusChangeRequests,
    acceptBlockingStatusChangeRequest,
    declineBlockingStatusChangeRequest,
} = require("../controllers/file.controller");
const {request} = require("express");

router.get("/authShibboleth", authShibboleth)

router.post("/uploadFile", uploadFile);

router.get("/fileMetaData/:id", fileMetaData);

router.get("/downloadFileViaId/:id", fileViaId);

router.post("/requestBlockingStatusChange/:id", requestBlockingStatusChange);

router.get("/blockingStatusChangeRequests", blockingStatusChangeRequests);

router.delete("/acceptBlockingStatusChangeRequest/:requestId", acceptBlockingStatusChangeRequest);

router.delete("/declineBlockingStatusChangeRequest/:requestId", declineBlockingStatusChangeRequest);

module.exports = router;
