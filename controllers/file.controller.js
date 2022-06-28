const File = require("../models/file.model");
const Hash = require("../models/hash.model");
const ChangeBlockingRequest = require("../models/changeblockingrequest.model");
const crypto = require("crypto");
const { shibbolethAuth } = require("./shibboleth.controller");

const blockListUrl = "https://www.tu-chemnitz.de/informatik/DVS/blocklist";


// function to delete old files from db automatically
// similar to https://stackoverflow.com/questions/66954486/mongoose-delete-records-after-certain-time
// and https://stackoverflow.com/questions/1296358/how-to-subtract-days-from-a-plain-date
async function deleteUnusedFiles() {
    const now = new Date().getTime();
    const timeToLive = 1000 * 60 * 60 * 24 * 14; // time since latest download until file gets deleted: 14 days
    const earliestAllowedLatestDownloadDate = now - timeToLive;
    File.deleteMany({ "latestDownloadDate": { $lte: earliestAllowedLatestDownloadDate } }, (error, deletion) => {
        if (error) {
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

async function updateHashCache() {
    console.log("Service for updating local hash cache started...");

    // zuerst: Array aller in Hash-Datenbank gecachten Hashes abrufen
    let hashCache = await Hash.find({}).then((hashResult) => {
        return hashResult;
    }).catch((hashError) => {
        return -1;
    });
    // falls es beim Abruf einen Fehler gab: entsprechende Fehlermeldung in Konsole Drucken.
    if (hashCache === -1) {
        console.log("HashStatusUpdateService: Error getting local SHA256 hash blocking list. Please check connection to the distributed blocklist web service");

    } else { // wenn kein Fehler: mit WTC authentifizieren und eine Axios-Instanz mit allen dabei erhaltenen Cookies erzeugen
        const authenticatedAxiosClient = await shibbolethAuth();
        if (authenticatedAxiosClient === null) {
            console.log("Fehler beim Authentifizieren über WTC der TU Chemnitz.");
        } else { // wenn bei Erzeugung der Axios-Instanz kein Fehler auftrat: durch Array von gecachten Hashes iterieren
            for (let hashIterator = 0; hashIterator < hashCache.length; hashIterator++) {
                console.log("HashStatusUpdateService: Updating BlockingStatus for hash: " + hashCache[hashIterator].sha256Hash);
                // für jeden Hash des Arrays: aktuellen Blockstatus von Distributed Blocklist Service abfragen
                let newHashStatus = await authenticatedAxiosClient({
                    method: "get",
                    url: blockListUrl + "/" + hashCache[hashIterator].sha256Hash,
                    withCredentials: true,
                }, {withCredentials: true}).then((blockListResponse) => {
                    
                    // wenn Blocklist web service bekannten Status liefert: Wert für neuen Blocking-Status entsprechend setzen, sonst Fehlermeldung
                    if(blockListResponse.status === 200 || blockListResponse.status === 210) {
                        return (blockListResponse.status === 200) ? false : true;
                    } else if(blockListResponse.status === 418) {
                        hashIterator --; // wenn nur http-status 418 am Fehler schuld ist: diesen Hash noch einmal probieren
                        console.log("HashStatusUpdateService: Teapot, retrying hash...");
                        return -1;
                    }
                    else {
                        console.log("HashStatusUpdateService: Fehler beim Abruf des neuen Blockierungsstatus für Hash: " + hashCache[hashIterator].sha256Hash + " Grund: fehlerhafter HTTP-Status " + blockListResponse.status);
                        return -1;
                    }
                }).catch((error) => {
                    console.log("HashStatusUpdateService: Fehler beim Abruf des neuen Blockierungsstatus für Hash: " + hashCache[hashIterator].sha256Hash + " Grund: " + error);
                    return -1;
                });
                if(newHashStatus === -1) {} else { // wenn kein Fehler beim Abfragen des Blocklist Webservices:

                    // zunächst überprüfen, ob der aktuelle Status schon der richtige ist - wenn ja: kein weiterer Datenbankzugriff notwendig, wenn nein:
                    if(!(hashCache[hashIterator].isBlocked === newHashStatus)) {
                        // Eintragen des neuen Status in den entsprechenden Eintrag im lokalen hash cache und bei Fehler entsprechende Meldung
                        let updatedHash = await Hash.updateOne({"sha256Hash": hashCache[hashIterator].sha256Hash}, {$set: {"isBlocked": newHashStatus}}).then((updatedStatusHash) => {
                            return updatedStatusHash;
                        }).catch((error) => {
                            return -1;
                        });
                        if(updatedHash === -1) {
                            console.log("HashStatusUpdateService: Fehler beim Speichern des neuen Blockierungsstatus für Hash: " + hashCache[hashIterator].sha256Hash);
                        } else {
                            // wenn kein Fehler beim update des lokalen Hash: auch veraltete (Un)Blocking-Requests löschen, die sich noch auf den alten Blocking-Status beziehen
                            ChangeBlockingRequest.deleteMany({"sha256Hash": hashCache[hashIterator].sha256Hash}, (error, deletion) => {
                                if(error) {
                                    console.log("HashStatusUpdateService: Fehler beim Löschen einer veralteten Blocking/Unblocking-Anfrage.");
                                }
                            })
                        }
                    }
                }
            }
        }
    }
    // hashes sollen zumindest alle 12 Stunden aktualisiert werden
    // da es Fehler bei der Verbindung geben kann, wurden hier stattdessen 6 Stunden gesetzt - dieser Wert ist bei Bedarf einfach anzupassen
    setTimeout(async () => {
        await updateHashCache();
    }, (1000 * 60 * 60 * 6));
}

updateHashCache().then(() => {
    console.log("Service for updating local hash cache completed.");
})

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

        if (fileData === null) {
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
            return res.status(404).send("Angegebene ID befindet sich nicht im richtigen Format und konnte nicht gefunden werden.");
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
                return res.status(404).send("Angegebene ID befindet sich nicht im richtigen Format und konnte nicht gefunden werden.");
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
                return res.status(400).send("Fehlerhafte Statusaenderungsanfrage - der angeforderte Blocking-Status ist bereits gesetzt.");
            } else {
                // Senden der Änderungsanfrage an den Blocklist web service
                return authenticatedAxiosClient({
                    method: (changeRequest.blockFile) ? "put" : "delete",
                    url: blockListUrl + "/" + changeRequest.sha256Hash,
                    withCredentials: true,
                }, { withCredentials: true }).then((blocklistResult) => {

                    // wenn Blocklist service erwarteten Status zurückgibt, trage Änderungen auch in lokalen SHA256-Cache ein
                    if (blocklistResult.status === 201 || blocklistResult.status === 204) {
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
    uploadFile,
    fileMetaData,
    fileViaId,
    requestBlockingStatusChange,
    blockingStatusChangeRequests,
    acceptBlockingStatusChangeRequest,
    declineBlockingStatusChangeRequest,
}