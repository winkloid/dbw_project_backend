const File = require("../models/file.model");
const crypto = require("crypto");

const uploadFile = (req, res) => {
    if (!req.files.uploadedFile) { //|| Object.keys(req.files.uploadedFiles).length === 0) {
        return res.status(400).send("Fehler: Keine Dateien hochgeladen.");
    }
    else if (req.files.uploadedFile.truncated) {
        console.log(req.files.uploadedFile.size);
        return res.status(400).send("Fehler: Datei ist zu gross.");
    }
    else {
        let uploadedFile = req.files.uploadedFile.data;
        let uploadDate = new Date();
        let latestDownloadDate = new Date();
        let sha256Hash = crypto.createHash("sha256").update(uploadedFile).digest('hex');
        let fileSize = req.files.uploadedFile.size;
        let fileName = req.files.uploadedFile.name;
        console.log(sha256Hash + " " + fileSize + " " + fileName);
        return res.status(200).send("Erfolg: Datei gespeichert.");
    }
    let file = new File({

    });
}

module.exports = {
    uploadFile,
}