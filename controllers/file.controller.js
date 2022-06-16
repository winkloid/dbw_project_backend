const File = require("../models/file.model");
const Hash = require("../models/hash.model");
const ChangeBlockingRequest = require("../models/changeblockingrequest.model");
const crypto = require("crypto");
const { shibbolethAuth } = require("./shibboleth.controller");

const blockListUrl = "https://www.tu-chemnitz.de/informatik/DVS/blocklist";


// function to delete old files from db automatically
async function deleteUnusedFiles() {
    const now = new Date().getTime();
    const timeToLive = 1000 * 60 * 60 * 24 * 14; // time since latest download until file gets deleted: 14 days
    const earliestAllowedLatestDownloadDate = now - timeToLive;
    File.deleteMany({ "latestDownloadDate": { $lte: earliestAllowedLatestDownloadDate } }, (error, deletion) => {
        if(error) {
            console.log("Error deleting old files. Please check connection to database");
        } else {
            console.log("Service for deleting unused files deleted " + deletion.deletedCount + " files.");
        }
    });
    // automatically recall every 12 hours
    setTimeout(async () => {
        await deleteUnusedFiles();
    }, (1000 * 60 * 60 * 12));
}

deleteUnusedFiles().then(() => {
    console.log("Service for deleting unused files started...");
})

const authShibboleth = async (req, res) => {
    const authenticatedAxiosClient = await shibbolethAuth();
    if (authenticatedAxiosClient === null) {
        return res.status(500).send("Fehler beim Authentifizieren über WTC der TU Chemnitz.");
    }
    let blockListResponse = await authenticatedAxiosClient({
        method: "get",
        url: "https://www.tu-chemnitz.de/informatik/DVS/blocklist",
        withCredentials: true,
    }, { withCredentials: true }).then((response) => {
        return response;
    });
    console.log(blockListResponse.data);
    return res.status(200).send("OK HTTP");
}

const uploadFile = async (req, res) => {
    // Bad request status, wenn keine Dateien hochgeladen wurden
    if (!req.files.uploadedFile) { //|| Object.keys(req.files.uploadedFiles).length === 0) {
        return res.status(400).send("Fehler: Keine Dateien hochgeladen.");
    }
    // Bad request status, wenn zu große Daten versucht werden, hochzuladen
    else if (req.files.uploadedFile.truncated) {
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
        const file = new File({
            fileBinary: uploadedFile,
            fileName: fileName,
            fileSize: fileSize,
            fileMimetype: fileMimetype,
            uploadDate: uploadDate,
            latestDownloadDate: latestDownloadDate,
            sha256Hash: sha256Hash,
        });

        // Speichern des Datenbankdokuments fuer die hochgeladene Datei in MongoDB
        let fileData = await file.save().then((result) => {
            return result;
        }).catch((error) => {
            return null;
        });

        if(fileData === null) {
            // interner Server Fehler, wenn Datei nicht gespeichert werden konnte
            return res.status(500).send("Fehler beim Speichern der Datei.");
        }
            
        // Ueberpruefen, ob Hash der hochgeladenen Datei schon vorhanden ist: wenn ja, kein neues Dokument dafuer erstellen
        let existingHashes = await Hash.find({ "sha256Hash": sha256Hash }).then((existingHashes) => {
            return existingHashes;
        }).catch((error) => {
            return null;
        });

        if (existingHashes === null) {
            return res.status(500).send("Fehler beim Überprüfen der SHA-Hash-Datenbank.");
        }

        // wenn der SHA256-Hash noch nicht in der Hash-Datenbank gecached ist, dann Blocklistenservice abfragen und Antwort in Hash-Datenbank einpflegen
        if (!existingHashes.length) {
            const authenticatedAxiosClient = await shibbolethAuth();
            if (authenticatedAxiosClient === null) {
                // wenn Fehler bei Authentifizierung mit WTC system auftritt
                return res.status(500).send("Fehler beim Authentifizieren mit WTC. Bitte versuchen Sie es später erneut.");
            } else {
                // Blockservice nach sha hash abfragen
                let blockListResponse = await authenticatedAxiosClient({
                    method: "get",
                    url: blockListUrl + "/" + sha256Hash,
                    withCredentials: true,
                }, { withCredentials: true }).then((response) => {
                    return response;
                }).catch((error) => {
                    return null;
                });

                // wenn Blocklist Service keine gültige Antwort liefert
                if (blockListResponse === null) {
                    return res.status(500).send("Fehler beim Abruf des Blocking-Services.");
                }
                // wenn blocklist service gültigen Status-Code liefert (200 oder 210)
                if (blockListResponse.status === 200 || blockListResponse.status === 210) {
                    let hash = new Hash({
                        sha256Hash: file.sha256Hash,
                        isBlocked: (blockListResponse.status === 200) ? false : true,
                    });
                    hash.save((error) => {
                        if (error) {
                            return res.status(500).send("Fehler beim Speichern des Dateihashes.");
                        }
                    });
                } else {
                    // wenn Blocklist service unbekannten Status-Code liefert
                    return res.status(500).send("Fehler beim Abruf des Blocking-Services.");
                }
            }
        }
        // wenn alle Daten gespeichert wurden: Rueckgabe des Status-Codes HTTP-OK und einer Download-URL
        return res.status(200).json({
            fileUrl: fileData._id.toString(),
        });
    }
}

const fileMetaData = (req, res) => {
    // Versuche, Datei zu finden, die die als Param uebergebene ID besitzt
    File.findById(req.params.id, (error, result) => {
        if (error) {
            return res.status(404).send("Angegebene ID befindet sich nicht im richtigen Format und konnte nicht gefunden werden.");
        }

        // wenn nicht gefunden: 404-Status
        if (result === null) {
            return res.status(404).send("Die angefragte Datei wurde nicht gefunden.");
        }

        // wenn gefunden: Metadaten und Hash finden und zurückgeben
        Hash.findOne({ "sha256Hash": result.sha256Hash }, (error, hashResult) => {
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
    File.findById(req.params.id, (error, result) => {
        if (error) {
            return res.status(500).send("Interner Fehler");
        }

        // wenn nicht gefunden: 404-Status
        if (result === null) {
            return res.status(404).send("Die angefragte Datei wurde nicht gefunden.");
        }

        // wenn gefunden: Hash suchen, pruefen, ob blockiert und wenn nicht: Datei senden
        Hash.findOne({ "sha256Hash": result.sha256Hash }, (error, hashResult) => {
            if (hashResult === null || error) {
                return res.status(500).send("Fehler bei Abfrage des Blocking-Status. ");
            }
            if (hashResult.isBlocked) {
                return res.status(403).send("Das Herunterladen dieser Datei ist nicht erlaubt.");
            } else {
                // Änderung des Download-Datums des entsprechenden Files
                File.updateOne({ "_id": result._id }, { $set: { "latestDownloadDate": new Date() } }, (error, dateUpdateResult) => {
                    if (error) {
                        return res.status(500).send("Interner Fehler beim Aktualisieren des Download-Datums.");
                    }
                    // beim Senden der Datei: Header, die Dateinamen und Mimetype der Datei enthalten zum besseren Verstaendnis fuer HTTP-Client
                    return res.status(200).setHeader('Content-disposition', 'attachment; filename=' + result.fileName, 'Content-type', result.fileMimetype).send(result.fileBinary);
                });
            }
        });
    });
}

const requestBlockingStatusChange = (req, res) => {
    try {
        const requestMessage = req.body.requestMessage;
        let requestBlocking = false;
        if (req.body.blockFile === "true") { // blockFile muss hier als String mit "true" oder "false" gesendet werden für mehr Eindeutigkeit
            requestBlocking = true;
        }

        File.findById(req.params.id, (error, result) => {
            if (error) {
                return res.status(500).send("Fehler beim Verarbeiten der Datei-ID.");
            }

            if (result === null) {
                return res.status(404).send("Die Datei, auf die sich die Anfrage bezog, wurde nicht gefunden.");
            }

            // ueberpruefen, ob entsprechende Datei bereits blockiert/deblockiert ist
            Hash.findOne({ "sha256Hash": result.sha256Hash }, (error, hashResult) => {
                if (hashResult === null || error) {
                    return res.status(500).send("Interner Fehler bei Abfrage des Blocking-Status. ");
                }
                if ((requestBlocking && hashResult.isBlocked) || (!requestBlocking && !hashResult.isBlocked)) {
                    if (requestBlocking) {
                        return res.status(400).send("Die entsprechende Datei ist bereits blockiert.");
                    } else {
                        return res.status(400).send("Die entsprechende Datei ist bereits de-blockiert.");
                    }
                }

                const changeBlockingRequest = new ChangeBlockingRequest({
                    requestMessage: (requestMessage) ? requestMessage : "",
                    blockFile: (requestBlocking) ? true : false,
                    requestDate: new Date(),
                    fileId: result._id,
                    fileName: result.fileName,
                    fileSize: result.fileSize,
                    fileMimetype: result.mimetype,
                    uploadDate: result.uploadDate,
                    sha256Hash: result.sha256Hash,
                });

                changeBlockingRequest.save((error) => {
                    if (error) {
                        return res.status(500).send("Interner Fehler beim Speichern der Unblocking-Anfrage.");
                    }
                });

                if (requestBlocking) {
                    return res.status(200).send("Die Blocking-Anfrage wurde gespeichert und wird bald vom Admin bearbeitet.");
                } else {
                    return res.status(200).send("Die Unblocking-Anfrage wurde gespeichert und wird bald vom Admin bearbeitet.");
                }
            });
        });

    } catch (error) {
        res.status(400).send("Fehler: " + error);
    }
}

const blockingStatusChangeRequests = (req, res) => {
    ChangeBlockingRequest.find({}, (error, changeBlockingRequests) => {
        if (error) {
            res.status(500).send(error);
        } else {
            return res.status(200).send(changeBlockingRequests);
        }
    });
}

const acceptBlockingStatusChangeRequest = async (req, res) => {
    let authenticatedAxiosClient = await shibbolethAuth();
    ChangeBlockingRequest.findById(req.params.requestId, (error, changeRequest) => {
        if (error) {
            return res.status(404).send(error);
        }
        if (changeRequest === null) {
            return res.status(404).send("Die Anfrage zur Aenderung des Blocking-Status wurde nicht gefunden.");
        }

        Hash.findOne({ "sha256Hash": changeRequest.sha256Hash }, (error, hashResult) => {
            if (error) {
                return res.status(404).send(error);
            }
            if (changeRequest.blockFile === hashResult.isBlocked) {
                return res.status(500).send("Fehlerhafte Statusaenderungsanfrage - der angeforderte Blocking-Status ist bereits gesetzt.");
            } else {
                // Senden der Änderungsanfrage an den Blocklist web service
                return authenticatedAxiosClient({
                    method: (changeRequest.blockFile) ? "put" : "delete",
                    url: blockListUrl + "/" + changeRequest.sha256Hash,
                    withCredentials: true,
                }, {withCredentials: true}).then((blocklistResult) => {

                    // wenn Blocklist service erwarteten Status zurückgibt, trage Änderungen auch in lokalen SHA256-Cache ein
                    if(blocklistResult.status === 201 || blocklistResult.status === 204) {
                        console.log(blocklistResult.status);
                        Hash.updateOne({ "sha256Hash": changeRequest.sha256Hash }, { $set: { isBlocked: changeRequest.blockFile } }, (error, hashUpdate) => {
                            ChangeBlockingRequest.deleteMany({ "sha256Hash": changeRequest.sha256Hash }, (error) => {
                                if (error) {
                                    return res.status(500).send(error);
                                } else {
                                    return res.status(200).send("Erfolg: Status geaendert.");
                                }
                            });
                        });
                    } else {
                        // wenn Blocklist Service einen unerwarteten Status zurückgibt
                        return res.status(500).send("Interner Fehler: Blocklist Web Service nicht erreichbar.");
                    }
                }).catch((error) => {
                    return res.status(500).send("Interner Fehler bei der Abfrage des Blocklist Web Services: " + error);
                });  
            }
        });
    });
}

const declineBlockingStatusChangeRequest = (req, res) => {
    ChangeBlockingRequest.deleteOne({ "_id": req.params.requestId }, (error, changeRequest) => {
        console.log(changeRequest);
        if (error) {
            return res.status(404).send(error);
        } else if (changeRequest.deletedCount === 0) {
            return res.status(404).send("Fehler: Statusaenderungsanfrage nicht gefunden");
        }
        else {
            return res.status(200).send("Erfolg: Anfrage abgelehnt.");
        }
    });
}

module.exports = {
    authShibboleth,
    uploadFile,
    fileMetaData,
    fileViaId,
    requestBlockingStatusChange,
    blockingStatusChangeRequests,
    acceptBlockingStatusChangeRequest,
    declineBlockingStatusChangeRequest,
}