const File = require("../models/file.model");
const Hash = require("../models/hash.model");
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

        let file = new File({
            fileBinary: uploadedFile,
            fileName: fileName,
            fileSize: fileSize,
            uploadDate: uploadDate,
            latestDownloadDate: latestDownloadDate,
            sha256Hash: sha256Hash,
        });
        file.save((error, result) => {
            if(error) {
                return res.status(500).send("Fehler beim Speichern der Datei.");
            } else {
                // Nur grobe Annäherung, muss spaeter noch verbessert werden!
                Hash.find({"sha256Hash": sha256Hash}, (error, existingHashes) => {
                    if (!existingHashes.length) {
                        let hash = new Hash({
                            sha256Hash: file.sha256Hash,
                            isBlocked: true,
                        });
                        hash.save((error) => {
                            if (error) {
                                return res.status(500).send("Fehler beim Speichern des Dateihashes.");
                            }
                        });
                    }
                });

                return res.status(200).json({
                    fileUrl: "https://localhost:49749/api/files/downloadFileById/" + result._id.toString(),
                });
            }
        })
    }
}

const fileMetaData = (req, res) => {
    File.findById(req.params.id,(error, result) => {
        if (result === null) {
            return res.status(404).send("Die angefragte Datei wurde nicht gefunden.");
        }

        Hash.findOne({"sha256Hash": result.sha256Hash}, (error, hashResult) => {
            if (hashResult === null || error) {
                return res.status(500).send("Fehler bei Abfrage des Blocking-Status. ");
            }
            console.log(hashResult);
            return res.status(200).json({
                fileName: result.fileName,
                fileSize: result.fileSize,
                uploadDate: result.uploadDate,
                lastUsedDate: result.latestDownloadDate,
                sha256Hash: result.sha256Hash,
                isBlocked: hashResult.isBlocked,
            });
        });
    });
}

module.exports = {
    uploadFile,
    fileMetaData,
}