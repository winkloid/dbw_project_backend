const File = require("../models/file.model");
const Hash = require("../models/hash.model");
const crypto = require("crypto");

const uploadFile = (req, res) => {
    // Bad request status, wenn keine Dateien hochgeladen wurden
    if (!req.files.uploadedFile) { //|| Object.keys(req.files.uploadedFiles).length === 0) {
        return res.status(400).send("Fehler: Keine Dateien hochgeladen.");
    }
    // Bad request status, wenn zu große Daten versucht werden, hochzuladen
    else if (req.files.uploadedFile.truncated) {
        console.log(req.files.uploadedFile.size);
        return res.status(400).send("Fehler: Datei ist zu gross.");
    }
    else {
        // wenn eine Datei hochgeladen wurde und diese nicht zu groß ist: Auslesen der Datei und einiger Metadaten und Speicherung in File-Collection
        let uploadedFile = req.files.uploadedFile.data;
        let uploadDate = new Date();
        let latestDownloadDate = new Date();
        let sha256Hash = crypto.createHash("sha256").update(uploadedFile).digest('hex');
        let fileSize = req.files.uploadedFile.size;
        let fileName = req.files.uploadedFile.name;
        let fileMimetype = req.files.uploadedFile.mimetype;
        // console.log(sha256Hash + " " + fileSize + " " + fileName);
        // console.log(fileMimetype);

        // Erstellen eines Datenbankdokuments fuer die hochgeladene Datei
        let file = new File({
            fileBinary: uploadedFile,
            fileName: fileName,
            fileSize: fileSize,
            fileMimetype: fileMimetype,
            uploadDate: uploadDate,
            latestDownloadDate: latestDownloadDate,
            sha256Hash: sha256Hash,
        });

        // Speichern des Datenbankdokuments fuer die hochgeladene Datei in MongoDB
        file.save((error, result) => {
            // interner Servier Fehler, wenn Datei nicht gespeichert werden konnte
            if(error) {
                return res.status(500).send("Fehler beim Speichern der Datei.");
            } else {
                // Ueberpruefen, ob Hash der hochgeladenen Datei schon vorhanden ist: wenn ja, kein neues Dokument dafuer erstellen
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
                // wenn alle Daten gespeichert wurden: Rueckgabe des Status-Codes HTTP-OK und einer Download-URL
                return res.status(200).json({
                    fileUrl: "http://localhost:49749/api/files/downloadFileViaId/" + result._id.toString(),
                });
            }
        })
    }
}

const fileMetaData = (req, res) => {
    // Versuche, Datei zu finden, die die als Param uebergebene ID besitzt
    File.findById(req.params.id,(error, result) => {
        // wenn nicht gefunden: 404-Status
        if (result === null) {
            return res.status(404).send("Die angefragte Datei wurde nicht gefunden.");
        }

        // wenn gefunden: Metadaten und Hash finden und zurückgeben
        Hash.findOne({"sha256Hash": result.sha256Hash}, (error, hashResult) => {
            if (hashResult === null || error) {
                return res.status(500).send("Fehler bei Abfrage des Blocking-Status. ");
            }
            return res.status(200).json({
                fileName: result.fileName,
                fileSize: result.fileSize,
                fileMimetype: result.fileMimetype,
                uploadDate: result.uploadDate,
                lastUsedDate: result.latestDownloadDate,
                sha256Hash: result.sha256Hash,
                isBlocked: hashResult.isBlocked,
            });
        });
    });
}

const fileViaId = (req, res) => {
    // versuche, Datei zu finden, die die als Param uebergebene ID besitzt
    File.findById(req.params.id,(error, result) => {
        // wenn nicht gefunden: 404-Status
        if (result === null) {
            return res.status(404).send("Die angefragte Datei wurde nicht gefunden.");
        }

        // wenn gefunden: Hash suchen, pruefen, ob blockiert und wenn nicht: Datei senden
        Hash.findOne({"sha256Hash": result.sha256Hash}, (error, hashResult) => {
            if (hashResult === null || error) {
                return res.status(500).send("Fehler bei Abfrage des Blocking-Status. ");
            }
            if(hashResult.isBlocked) {
                return res.status(403).send("Das Herunterladen dieser Datei ist nicht erlaubt.");
            } else {
                // beim Senden der Datei: Header, die Dateinamen und Mimetype der Datei enthalten zum besseren Verstaendnis fuer HTTP-Client
                res.status(200).setHeader('Content-disposition', 'attachment; filename=' + result.fileName, 'Content-type', result.fileMimetype).send(result.fileBinary);
            }
        });
    });
}

module.exports = {
    uploadFile,
    fileMetaData,
    fileViaId,
}